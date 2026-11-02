import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { DataSource, Repository } from 'typeorm';
import { UserRole, UserStatus } from '../common/enums';
import { PaginatedResult } from '../common/types';
import { User } from '../database/entities';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export type PublicUser = Omit<User, 'passwordHash' | 'version'>;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async list(query: ListUsersDto): Promise<PaginatedResult<PublicUser>> {
    const builder = this.usersRepository.createQueryBuilder('user');
    if (query.role) {
      builder.andWhere('user.role = :role', { role: query.role });
    }
    if (query.status) {
      builder.andWhere('user.status = :status', { status: query.status });
    }
    if (query.q?.trim()) {
      const keyword = `%${query.q.trim()}%`;
      builder.andWhere(
        '(user.username LIKE :keyword OR user.fullName LIKE :keyword OR user.employeeNo LIKE :keyword)',
        { keyword },
      );
    }

    const [users, total] = await builder
      .orderBy('user.createdAt', 'DESC')
      .skip(query.skip)
      .take(query.pageSize)
      .getManyAndCount();

    return {
      items: users.map((user) => this.toPublicUser(user)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async findOne(id: string): Promise<PublicUser> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return this.toPublicUser(user);
  }

  async create(dto: CreateUserDto): Promise<PublicUser> {
    await this.ensureUnique(dto.username, dto.employeeNo ?? null);
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    const user = this.usersRepository.create({
      username: dto.username,
      employeeNo: dto.employeeNo ?? null,
      fullName: dto.fullName,
      role: dto.role,
      passwordHash,
      status: UserStatus.ACTIVE,
      lastLoginAt: null,
    });
    return this.toPublicUser(await this.usersRepository.save(user));
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actorUserId: string,
  ): Promise<PublicUser> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(User);
      const user = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) {
        throw new NotFoundException('用户不存在');
      }

      if (dto.employeeNo !== undefined && dto.employeeNo !== null) {
        const existing = await repository.findOne({
          where: { employeeNo: dto.employeeNo },
        });
        if (existing && String(existing.id) !== id) {
          throw new ConflictException('工号已存在');
        }
      }

      const removesActiveAdmin =
        user.role === UserRole.ADMIN
        && user.status === UserStatus.ACTIVE
        && (
          (dto.role !== undefined && dto.role !== UserRole.ADMIN)
          || (dto.status !== undefined && dto.status !== UserStatus.ACTIVE)
        );
      if (removesActiveAdmin) {
        const activeAdmins = await repository.find({
          where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
          lock: { mode: 'pessimistic_write' },
        });
        if (activeAdmins.length <= 1) {
          throw new ForbiddenException('至少需要保留一个启用的管理员');
        }
      }

      if (dto.fullName !== undefined) {
        user.fullName = dto.fullName;
      }
      if (dto.employeeNo !== undefined) {
        user.employeeNo = dto.employeeNo || null;
      }
      if (dto.role !== undefined) {
        user.role = dto.role;
      }
      if (dto.status !== undefined) {
        user.status = dto.status;
      }
      if (String(user.id) === actorUserId && dto.status === UserStatus.DISABLED) {
        throw new ForbiddenException('不能停用当前登录账号');
      }

      return this.toPublicUser(await repository.save(user));
    });
  }

  async resetPassword(id: string, dto: ResetPasswordDto): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    await this.usersRepository.update(id, { passwordHash });
  }

  private async ensureUnique(
    username: string,
    employeeNo: string | null,
  ): Promise<void> {
    const usernameExists = await this.usersRepository.exists({ where: { username } });
    if (usernameExists) {
      throw new ConflictException('用户名已存在');
    }
    if (employeeNo) {
      const employeeNoExists = await this.usersRepository.exists({
        where: { employeeNo },
      });
      if (employeeNoExists) {
        throw new ConflictException('工号已存在');
      }
    }
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: String(user.id),
      username: user.username,
      employeeNo: user.employeeNo,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
