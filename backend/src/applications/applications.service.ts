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
  TodoType,
  UserRole,
} from '../common/enums';
import { canTransitionApplication } from '../common/domain/state-transitions';
import { PaginatedResult, AuthenticatedUser } from '../common/types';
import { randomApplicationNo } from '../common/utils/id.util';
import {
  ApplicationEvent,
  Asset,
  BorrowApplication,
  BorrowLoan,
  Notification,
  TodoItem,
} from '../database/entities';
import { NotificationsService } from '../notifications/notifications.service';
import { ApproveApplicationDto } from './dto/approve-application.dto';
import { CheckoutApplicationDto } from './dto/checkout-application.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ListApplicationsDto } from './dto/list-applications.dto';
import { RejectApplicationDto } from './dto/reject-application.dto';

interface WriteResult {
  application: BorrowApplication;
  notifications: Notification[];
  todos?: TodoItem[];
}

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(BorrowApplication)
    private readonly applicationsRepository: Repository<BorrowApplication>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    dto: CreateApplicationDto,
    actor: AuthenticatedUser,
  ): Promise<BorrowApplication> {
    const expectedReturnAt = new Date(dto.expectedReturnAt);
    if (expectedReturnAt.getTime() <= Date.now()) {
      throw new BadRequestException('预计归还时间必须晚于当前时间');
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const assetRepository = manager.getRepository(Asset);
      const applicationRepository = manager.getRepository(BorrowApplication);
      const eventRepository = manager.getRepository(ApplicationEvent);

      const asset = await assetRepository.findOne({
        where: { id: dto.assetId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!asset) {
        throw new NotFoundException('资产不存在');
      }
      if (asset.status !== AssetStatus.AVAILABLE) {
        throw new ConflictException('该资产当前不可申请');
      }

      const now = new Date();
      const application = await applicationRepository.save(
        applicationRepository.create({
          applicationNo: randomApplicationNo(now),
          assetId: String(asset.id),
          applicantUserId: actor.id,
          purpose: dto.purpose.trim(),
          expectedReturnAt,
          status: ApplicationStatus.PENDING,
          submittedAt: now,
          decisionByUserId: null,
          decisionAt: null,
          decisionComment: null,
        }),
      );

      await eventRepository.save(eventRepository.create({
        applicationId: String(application.id),
        eventType: ApplicationEventType.SUBMITTED,
        actorUserId: actor.id,
        fromStatus: null,
        toStatus: ApplicationStatus.PENDING,
        note: null,
      }));

      const adminWork = await this.notificationsService.createAdminWork(manager, {
        applicationId: String(application.id),
        applicationNo: application.applicationNo,
        assetName: asset.name,
        applicantName: actor.fullName,
        purpose: application.purpose,
        expectedReturnAt,
        notificationType: NotificationType.APPLICATION_SUBMITTED,
        notificationTitle: '收到新的借用申请',
        notificationBody:
          `${actor.fullName} 申请借用 ${asset.name}（${asset.assetNo}），`
          + `预计归还时间：${expectedReturnAt.toISOString()}。`,
        todoType: TodoType.APPROVAL,
        todoTitle: `审批借用申请 ${application.applicationNo}`,
      });

      return {
        application,
        notifications: adminWork.notifications,
        todos: adminWork.todos,
      };
    });

    this.notificationsService.pushAfterCommit(result.notifications, result.todos);
    return result.application;
  }

  async list(
    query: ListApplicationsDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedResult<BorrowApplication>> {
    const builder = this.applicationsRepository
      .createQueryBuilder('application')
      .leftJoinAndSelect('application.asset', 'asset')
      .leftJoinAndSelect('application.applicant', 'applicant')
      .leftJoinAndSelect('application.decisionBy', 'decisionBy');

    if (actor.role === UserRole.EMPLOYEE) {
      builder.andWhere('application.applicantUserId = :actorId', {
        actorId: actor.id,
      });
    } else if (query.applicantId) {
      builder.andWhere('application.applicantUserId = :applicantId', {
        applicantId: query.applicantId,
      });
    }
    if (query.status) {
      builder.andWhere('application.status = :status', { status: query.status });
    }
    if (query.assetId) {
      builder.andWhere('application.assetId = :assetId', {
        assetId: query.assetId,
      });
    }
    if (query.q?.trim()) {
      builder.andWhere('application.applicationNo LIKE :keyword', {
        keyword: `%${query.q.trim()}%`,
      });
    }

    const [items, total] = await builder
      .orderBy('application.submittedAt', 'DESC')
      .skip(query.skip)
      .take(query.pageSize)
      .getManyAndCount();
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async findOne(id: string, actor: AuthenticatedUser): Promise<BorrowApplication> {
    const application = await this.applicationsRepository.findOne({
      where: { id },
      relations: {
        asset: true,
        applicant: true,
        decisionBy: true,
      },
    });
    if (!application) {
      throw new NotFoundException('申请不存在');
    }
    if (
      actor.role === UserRole.EMPLOYEE
      && String(application.applicantUserId) !== actor.id
    ) {
      throw new ForbiddenException('无权查看该申请');
    }
    return application;
  }

  async events(id: string, actor: AuthenticatedUser): Promise<ApplicationEvent[]> {
    await this.findOne(id, actor);
    return this.dataSource.getRepository(ApplicationEvent).find({
      where: { applicationId: id },
      relations: { actor: true },
      order: { occurredAt: 'ASC', id: 'ASC' },
    });
  }

  async approve(
    id: string,
    dto: ApproveApplicationDto,
    actor: AuthenticatedUser,
  ): Promise<BorrowApplication> {
    const result = await this.dataSource.transaction(async (manager) => {
      const applicationRepository = manager.getRepository(BorrowApplication);
      const assetRepository = manager.getRepository(Asset);
      const eventRepository = manager.getRepository(ApplicationEvent);

      const snapshot = await applicationRepository.findOneBy({ id });
      if (!snapshot) {
        throw new NotFoundException('申请不存在');
      }
      const asset = await assetRepository.findOne({
        where: { id: snapshot.assetId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!asset) {
        throw new NotFoundException('申请关联的资产不存在');
      }
      const application = await applicationRepository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!application) {
        throw new NotFoundException('申请不存在');
      }
      if (!canTransitionApplication(application.status, ApplicationStatus.APPROVED)) {
        throw new ConflictException(`当前申请状态为 ${application.status}，不能批准`);
      }
      if (asset.status !== AssetStatus.AVAILABLE) {
        throw new ConflictException('资产当前不可借，不能批准该申请');
      }

      const now = new Date();
      application.status = ApplicationStatus.APPROVED;
      application.decisionByUserId = actor.id;
      application.decisionAt = now;
      application.decisionComment = dto.comment?.trim() || null;
      await applicationRepository.save(application);

      asset.status = AssetStatus.RESERVED;
      asset.updatedByUserId = actor.id;
      await assetRepository.save(asset);

      await eventRepository.save(eventRepository.create({
        applicationId: id,
        eventType: ApplicationEventType.APPROVED,
        actorUserId: actor.id,
        fromStatus: ApplicationStatus.PENDING,
        toStatus: ApplicationStatus.APPROVED,
        note: application.decisionComment,
      }));

      await this.notificationsService.completePendingTodos(
        manager,
        id,
        TodoType.APPROVAL,
      );

      const adminWork = await this.notificationsService.createAdminWork(manager, {
        applicationId: id,
        applicationNo: application.applicationNo,
        assetName: asset.name,
        applicantName: '',
        purpose: application.purpose,
        expectedReturnAt: application.expectedReturnAt,
        notificationType: NotificationType.HANDOVER_REQUIRED,
        notificationTitle: '有申请等待确认借出',
        notificationBody:
          `申请 ${application.applicationNo} 已批准，请在实际交接后确认借出。`,
        todoType: TodoType.HANDOVER,
        todoTitle: `确认借出 ${application.applicationNo}`,
      });

      const applicantNotification = await this.notificationsService.createNotification(
        manager,
        {
          recipientUserId: String(application.applicantUserId),
          notificationType: NotificationType.APPLICATION_APPROVED,
          title: '借用申请已批准',
          body:
            `您的申请 ${application.applicationNo} 已批准，`
            + '请联系管理员完成资产交接。',
          relatedApplicationId: id,
          dedupeKey: `APPLICATION_APPROVED:${id}:${application.applicantUserId}`,
        },
      );

      return {
        application,
        notifications: [
          ...adminWork.notifications,
          applicantNotification,
        ],
        todos: adminWork.todos,
      };
    });

    this.notificationsService.pushAfterCommit(result.notifications, result.todos);
    void this.notificationsService.pushTodoRefreshToAdmins(id).catch(() => undefined);
    return result.application;
  }

  async reject(
    id: string,
    dto: RejectApplicationDto,
    actor: AuthenticatedUser,
  ): Promise<BorrowApplication> {
    const result = await this.dataSource.transaction(async (manager) => {
      const applicationRepository = manager.getRepository(BorrowApplication);
      const eventRepository = manager.getRepository(ApplicationEvent);
      const application = await applicationRepository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!application) {
        throw new NotFoundException('申请不存在');
      }
      if (!canTransitionApplication(application.status, ApplicationStatus.REJECTED)) {
        throw new ConflictException(`当前申请状态为 ${application.status}，不能驳回`);
      }

      const reason = dto.reason.trim();
      if (!reason) {
        throw new BadRequestException('请填写驳回原因');
      }
      application.status = ApplicationStatus.REJECTED;
      application.decisionByUserId = actor.id;
      application.decisionAt = new Date();
      application.decisionComment = reason;
      await applicationRepository.save(application);

      await eventRepository.save(eventRepository.create({
        applicationId: id,
        eventType: ApplicationEventType.REJECTED,
        actorUserId: actor.id,
        fromStatus: ApplicationStatus.PENDING,
        toStatus: ApplicationStatus.REJECTED,
        note: reason,
      }));
      await this.notificationsService.completePendingTodos(
        manager,
        id,
        TodoType.APPROVAL,
      );

      const notification = await this.notificationsService.createNotification(
        manager,
        {
          recipientUserId: String(application.applicantUserId),
          notificationType: NotificationType.APPLICATION_REJECTED,
          title: '借用申请未通过',
          body: `您的申请 ${application.applicationNo} 未通过，原因：${reason}`,
          relatedApplicationId: id,
          dedupeKey: `APPLICATION_REJECTED:${id}:${application.applicantUserId}`,
        },
      );
      return {
        application,
        notifications: [notification],
      };
    });

    this.notificationsService.pushAfterCommit(result.notifications);
    void this.notificationsService.pushTodoRefreshToAdmins(id).catch(() => undefined);
    return result.application;
  }

  async cancel(id: string, actor: AuthenticatedUser): Promise<BorrowApplication> {
    const result = await this.dataSource.transaction(async (manager) => {
      const applicationRepository = manager.getRepository(BorrowApplication);
      const eventRepository = manager.getRepository(ApplicationEvent);
      const application = await applicationRepository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!application) {
        throw new NotFoundException('申请不存在');
      }
      if (String(application.applicantUserId) !== actor.id) {
        throw new ForbiddenException('只能取消自己的申请');
      }
      if (!canTransitionApplication(application.status, ApplicationStatus.CANCELLED)) {
        throw new ConflictException(`当前申请状态为 ${application.status}，不能取消`);
      }

      application.status = ApplicationStatus.CANCELLED;
      await applicationRepository.save(application);
      await eventRepository.save(eventRepository.create({
        applicationId: id,
        eventType: ApplicationEventType.CANCELLED,
        actorUserId: actor.id,
        fromStatus: ApplicationStatus.PENDING,
        toStatus: ApplicationStatus.CANCELLED,
        note: null,
      }));
      await this.notificationsService.cancelPendingTodos(
        manager,
        id,
        TodoType.APPROVAL,
      );

      const notifications = await this.notificationsService.createAdminNotifications(
        manager,
        {
          applicationId: id,
          notificationType: NotificationType.APPLICATION_CANCELLED,
          title: '借用申请已取消',
          body: `${actor.fullName} 取消了申请 ${application.applicationNo}。`,
        },
      );
      return { application, notifications };
    });

    this.notificationsService.pushAfterCommit(result.notifications);
    void this.notificationsService.pushTodoRefreshToAdmins(id).catch(() => undefined);
    return result.application;
  }

  async checkout(
    id: string,
    dto: CheckoutApplicationDto,
    actor: AuthenticatedUser,
  ): Promise<BorrowLoan> {
    const result = await this.dataSource.transaction(async (manager) => {
      const applicationRepository = manager.getRepository(BorrowApplication);
      const assetRepository = manager.getRepository(Asset);
      const loanRepository = manager.getRepository(BorrowLoan);
      const eventRepository = manager.getRepository(ApplicationEvent);

      const snapshot = await applicationRepository.findOneBy({ id });
      if (!snapshot) {
        throw new NotFoundException('申请不存在');
      }
      const asset = await assetRepository.findOne({
        where: { id: snapshot.assetId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!asset) {
        throw new NotFoundException('申请关联的资产不存在');
      }
      const application = await applicationRepository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!application) {
        throw new NotFoundException('申请不存在');
      }
      if (!canTransitionApplication(application.status, ApplicationStatus.CHECKED_OUT)) {
        throw new ConflictException(`当前申请状态为 ${application.status}，不能确认借出`);
      }
      if (asset.status !== AssetStatus.RESERVED) {
        throw new ConflictException('资产不是预留状态，不能确认借出');
      }

      const checkedOutAt = this.actualTime(
        dto.checkedOutAt,
        application.submittedAt,
        '实际借出时间',
      );
      const loan = await loanRepository.save(loanRepository.create({
        applicationId: id,
        checkedOutAt,
        expectedReturnAt: application.expectedReturnAt,
        handoverHandledByUserId: actor.id,
        handoverNote: dto.handoverNote?.trim() || null,
        returnedAt: null,
        returnHandledByUserId: null,
        returnNote: null,
      }));

      application.status = ApplicationStatus.CHECKED_OUT;
      await applicationRepository.save(application);
      asset.status = AssetStatus.BORROWED;
      asset.updatedByUserId = actor.id;
      await assetRepository.save(asset);

      await eventRepository.save(eventRepository.create({
        applicationId: id,
        eventType: ApplicationEventType.CHECKED_OUT,
        actorUserId: actor.id,
        fromStatus: ApplicationStatus.APPROVED,
        toStatus: ApplicationStatus.CHECKED_OUT,
        note: dto.handoverNote?.trim() || null,
      }));
      await this.notificationsService.completePendingTodos(
        manager,
        id,
        TodoType.HANDOVER,
      );

      const notification = await this.notificationsService.createNotification(
        manager,
        {
          recipientUserId: String(application.applicantUserId),
          notificationType: NotificationType.ASSET_CHECKED_OUT,
          title: '资产已借出',
          body:
            `申请 ${application.applicationNo} 已完成交接，`
            + `预计归还时间：${application.expectedReturnAt.toISOString()}。`,
          relatedApplicationId: id,
          dedupeKey: `ASSET_CHECKED_OUT:${id}:${application.applicantUserId}`,
        },
      );
      return { loan, notifications: [notification] };
    });

    this.notificationsService.pushAfterCommit(result.notifications);
    void this.notificationsService.pushTodoRefreshToAdmins(id).catch(() => undefined);
    return result.loan;
  }

  private actualTime(
    input: string | undefined,
    earliest: Date,
    label: string,
  ): Date {
    const value = input ? new Date(input) : new Date();
    if (Number.isNaN(value.getTime())) {
      throw new BadRequestException(`${label}格式不正确`);
    }
    if (value.getTime() > Date.now() + 60_000) {
      throw new BadRequestException(`${label}不能晚于当前时间`);
    }
    if (value.getTime() < earliest.getTime()) {
      throw new BadRequestException(`${label}不能早于申请提交时间`);
    }
    return value;
  }
}
