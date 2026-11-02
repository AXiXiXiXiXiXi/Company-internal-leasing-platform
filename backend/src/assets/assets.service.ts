import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AssetStatus, ApplicationStatus } from '../common/enums';
import { PaginatedResult } from '../common/types';
import { Asset, BorrowApplication } from '../database/entities';
import { ChangeAssetStatusDto } from './dto/change-asset-status.dto';
import { CreateAssetDto } from './dto/create-asset.dto';
import { ListAssetsDto } from './dto/list-assets.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetsRepository: Repository<Asset>,
    private readonly dataSource: DataSource,
  ) {}

  async list(query: ListAssetsDto): Promise<PaginatedResult<Asset>> {
    const builder = this.assetsRepository.createQueryBuilder('asset');

    if (query.status) {
      builder.andWhere('asset.status = :status', { status: query.status });
    }
    if (query.category) {
      builder.andWhere('asset.category = :category', { category: query.category });
    }
    if (query.q?.trim()) {
      const keyword = `%${query.q.trim()}%`;
      builder.andWhere(
        '(asset.assetNo LIKE :keyword OR asset.name LIKE :keyword OR asset.serialNo LIKE :keyword)',
        { keyword },
      );
    }

    const [items, total] = await builder
      .orderBy('asset.createdAt', 'DESC')
      .skip(query.skip)
      .take(query.pageSize)
      .getManyAndCount();
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async findOne(id: string): Promise<Asset> {
    const asset = await this.assetsRepository.findOne({
      where: { id },
    });
    if (!asset) {
      throw new NotFoundException('资产不存在');
    }
    return asset;
  }

  async create(dto: CreateAssetDto, actorUserId: string): Promise<Asset> {
    const asset = this.assetsRepository.create({
      ...dto,
      serialNo: dto.serialNo ?? null,
      notes: dto.notes ?? null,
      status: AssetStatus.AVAILABLE,
      createdByUserId: actorUserId,
      updatedByUserId: actorUserId,
    });
    return this.assetsRepository.save(asset);
  }

  async update(
    id: string,
    dto: UpdateAssetDto,
    actorUserId: string,
  ): Promise<Asset> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Asset);
      const asset = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!asset) {
        throw new NotFoundException('资产不存在');
      }
      Object.assign(asset, dto);
      asset.updatedByUserId = actorUserId;
      return repository.save(asset);
    });
  }

  async changeStatus(
    id: string,
    dto: ChangeAssetStatusDto,
    actorUserId: string,
  ): Promise<Asset> {
    return this.dataSource.transaction(async (manager) => {
      const assetRepository = manager.getRepository(Asset);
      const applicationRepository = manager.getRepository(BorrowApplication);
      const asset = await assetRepository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!asset) {
        throw new NotFoundException('资产不存在');
      }

      const target = dto.status;
      const allowed =
        (asset.status === AssetStatus.AVAILABLE && target === AssetStatus.MAINTENANCE)
        || (asset.status === AssetStatus.MAINTENANCE && target === AssetStatus.AVAILABLE)
        || (
          [AssetStatus.AVAILABLE, AssetStatus.MAINTENANCE].includes(asset.status)
          && target === AssetStatus.RETIRED
        );
      if (!allowed) {
        throw new ConflictException(`不能将资产从 ${asset.status} 变更为 ${target}`);
      }

      if (target === AssetStatus.MAINTENANCE || target === AssetStatus.RETIRED) {
        const activeApplications = await applicationRepository.count({
          where: {
            assetId: id,
            status: In([ApplicationStatus.APPROVED, ApplicationStatus.CHECKED_OUT]),
          },
        });
        if (activeApplications > 0) {
          throw new ConflictException('资产仍有预留或未归还借用，不能变更此状态');
        }
      }

      asset.status = target;
      asset.updatedByUserId = actorUserId;
      return assetRepository.save(asset);
    });
  }

  validateRequestedStatus(status: AssetStatus): void {
    if (![AssetStatus.AVAILABLE, AssetStatus.MAINTENANCE, AssetStatus.RETIRED].includes(status)) {
      throw new BadRequestException('只能手工设置可借、维修中或已报废状态');
    }
  }
}
