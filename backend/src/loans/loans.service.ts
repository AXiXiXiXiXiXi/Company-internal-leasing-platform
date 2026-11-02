import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  ApplicationEventType,
  ApplicationStatus,
  AssetStatus,
  NotificationType,
  UserRole,
} from '../common/enums';
import { AuthenticatedUser, PaginatedResult } from '../common/types';
import {
  ApplicationEvent,
  Asset,
  BorrowApplication,
  BorrowLoan,
} from '../database/entities';
import { NotificationsService } from '../notifications/notifications.service';
import { ListLoansDto, LoanView } from './dto/list-loans.dto';
import { ReturnLoanDto } from './dto/return-loan.dto';

@Injectable()
export class LoansService {
  constructor(
    @InjectRepository(BorrowLoan)
    private readonly loansRepository: Repository<BorrowLoan>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  async list(
    query: ListLoansDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedResult<BorrowLoan>> {
    const builder = this.loansRepository
      .createQueryBuilder('loan')
      .leftJoinAndSelect('loan.application', 'application')
      .leftJoinAndSelect('application.asset', 'asset')
      .leftJoinAndSelect('application.applicant', 'applicant')
      .leftJoinAndSelect('loan.handoverHandledBy', 'handoverHandler')
      .leftJoinAndSelect('loan.returnHandledBy', 'returnHandler');

    if (actor.role === UserRole.EMPLOYEE) {
      builder.andWhere('application.applicantUserId = :actorId', {
        actorId: actor.id,
      });
    } else if (query.applicantId) {
      builder.andWhere('application.applicantUserId = :applicantId', {
        applicantId: query.applicantId,
      });
    }
    if (query.assetId) {
      builder.andWhere('application.assetId = :assetId', {
        assetId: query.assetId,
      });
    }
    if (query.view === LoanView.ACTIVE) {
      builder.andWhere('loan.returnedAt IS NULL');
    } else if (query.view === LoanView.RETURNED) {
      builder.andWhere('loan.returnedAt IS NOT NULL');
    }
    if (query.overdueOnly) {
      builder
        .andWhere('loan.returnedAt IS NULL')
        .andWhere('loan.expectedReturnAt < :now', { now: new Date() });
    }
    if (query.q?.trim()) {
      const keyword = `%${query.q.trim()}%`;
      builder.andWhere(
        '(application.applicationNo LIKE :keyword'
        + ' OR asset.assetNo LIKE :keyword'
        + ' OR asset.name LIKE :keyword'
        + ' OR applicant.fullName LIKE :keyword)',
        { keyword },
      );
    }

    const [items, total] = await builder
      .orderBy('loan.checkedOutAt', 'DESC')
      .skip(query.skip)
      .take(query.pageSize)
      .getManyAndCount();
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async findOne(id: string, actor: AuthenticatedUser): Promise<BorrowLoan> {
    const loan = await this.loansRepository.findOne({
      where: { id },
      relations: {
        application: {
          asset: true,
          applicant: true,
        },
        handoverHandledBy: true,
        returnHandledBy: true,
      },
    });
    if (!loan) {
      throw new NotFoundException('借用记录不存在');
    }
    if (
      actor.role === UserRole.EMPLOYEE
      && String(loan.application.applicantUserId) !== actor.id
    ) {
      throw new ForbiddenException('无权查看该借用记录');
    }
    return loan;
  }

  async returnLoan(
    id: string,
    dto: ReturnLoanDto,
    actor: AuthenticatedUser,
  ): Promise<BorrowLoan> {
    const result = await this.dataSource.transaction(async (manager) => {
      const loanRepository = manager.getRepository(BorrowLoan);
      const applicationRepository = manager.getRepository(BorrowApplication);
      const assetRepository = manager.getRepository(Asset);
      const eventRepository = manager.getRepository(ApplicationEvent);

      const loanSnapshot = await loanRepository.findOneBy({ id });
      if (!loanSnapshot) {
        throw new NotFoundException('借用记录不存在');
      }
      const applicationSnapshot = await applicationRepository.findOneBy({
        id: loanSnapshot.applicationId,
      });
      if (!applicationSnapshot) {
        throw new NotFoundException('借用记录关联的申请不存在');
      }

      const asset = await assetRepository.findOne({
        where: { id: applicationSnapshot.assetId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!asset) {
        throw new NotFoundException('借用记录关联的资产不存在');
      }
      const application = await applicationRepository.findOne({
        where: { id: applicationSnapshot.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!application) {
        throw new NotFoundException('借用记录关联的申请不存在');
      }
      const loan = await loanRepository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!loan) {
        throw new NotFoundException('借用记录不存在');
      }

      if (loan.returnedAt) {
        throw new ConflictException('该借用已登记归还');
      }
      if (application.status !== ApplicationStatus.CHECKED_OUT) {
        throw new ConflictException(`当前申请状态为 ${application.status}，不能归还`);
      }
      if (asset.status !== AssetStatus.BORROWED) {
        throw new ConflictException('资产不是借出状态，不能登记归还');
      }

      const returnedAt = this.actualReturnTime(dto.returnedAt, loan.checkedOutAt);
      loan.returnedAt = returnedAt;
      loan.returnHandledByUserId = actor.id;
      loan.returnNote = dto.returnNote?.trim() || null;
      await loanRepository.save(loan);

      application.status = ApplicationStatus.RETURNED;
      await applicationRepository.save(application);
      asset.status = AssetStatus.AVAILABLE;
      asset.updatedByUserId = actor.id;
      await assetRepository.save(asset);

      await eventRepository.save(eventRepository.create({
        applicationId: String(application.id),
        eventType: ApplicationEventType.RETURNED,
        actorUserId: actor.id,
        fromStatus: ApplicationStatus.CHECKED_OUT,
        toStatus: ApplicationStatus.RETURNED,
        note: loan.returnNote,
      }));

      const notification = await this.notificationsService.createNotification(
        manager,
        {
          recipientUserId: String(application.applicantUserId),
          notificationType: NotificationType.ASSET_RETURNED,
          title: '资产归还已登记',
          body:
            `申请 ${application.applicationNo} 已登记归还，`
            + `归还时间：${returnedAt.toISOString()}。`,
          relatedApplicationId: String(application.id),
          dedupeKey:
            `ASSET_RETURNED:${application.id}:${application.applicantUserId}`,
        },
      );
      return { loan, notifications: [notification] };
    });

    this.notificationsService.pushAfterCommit(result.notifications);
    return result.loan;
  }

  private actualReturnTime(input: string | undefined, checkedOutAt: Date): Date {
    const value = input ? new Date(input) : new Date();
    if (Number.isNaN(value.getTime())) {
      throw new BadRequestException('实际归还时间格式不正确');
    }
    if (value.getTime() > Date.now() + 60_000) {
      throw new BadRequestException('实际归还时间不能晚于当前时间');
    }
    if (value.getTime() < checkedOutAt.getTime()) {
      throw new BadRequestException('实际归还时间不能早于实际借出时间');
    }
    return value;
  }
}
