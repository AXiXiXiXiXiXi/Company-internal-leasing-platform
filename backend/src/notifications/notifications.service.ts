import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import {
  NotificationType,
  TodoStatus,
  TodoType,
  UserRole,
  UserStatus,
} from '../common/enums';
import { PaginatedResult } from '../common/types';
import { Notification, TodoItem, User } from '../database/entities';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { ListTodosDto } from './dto/list-todos.dto';
import { SendNotificationDto } from './dto/send-notification.dto';

interface NotificationInput {
  recipientUserId: string;
  notificationType: NotificationType;
  title: string;
  body: string;
  relatedApplicationId: string | null;
  dedupeKey?: string | null;
  senderUserId?: string | null;
}

interface TodoInput {
  assigneeUserId: string;
  todoType: TodoType;
  title: string;
  relatedApplicationId: string;
  dedupeKey: string;
  dueAt?: Date | null;
}

export interface AdminWorkBatch {
  notifications: Notification[];
  todos: TodoItem[];
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @InjectRepository(TodoItem)
    private readonly todosRepository: Repository<TodoItem>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async list(
    userId: string,
    query: ListNotificationsDto,
  ): Promise<PaginatedResult<Notification>> {
    const builder = this.notificationsRepository
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.sender', 'sender')
      .leftJoinAndSelect('notification.relatedApplication', 'application')
      .leftJoinAndSelect('application.asset', 'asset')
      .where('notification.recipientUserId = :userId', { userId });
    if (query.unreadOnly) {
      builder.andWhere('notification.isRead = :isRead', { isRead: false });
    }
    const [items, total] = await builder
      .orderBy('notification.createdAt', 'DESC')
      .skip(query.skip)
      .take(query.pageSize)
      .getManyAndCount();
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.notificationsRepository.count({
      where: { recipientUserId: userId, isRead: false },
    });
  }

  async sendAdminMessage(
    senderUserId: string,
    dto: SendNotificationDto,
  ): Promise<{ sentCount: number; recipientUserIds: string[] }> {
    const requestedIds = [...new Set(dto.recipientUserIds ?? [])];
    if (!dto.sendToAll && requestedIds.length === 0) {
      throw new BadRequestException('请至少选择一名接收人');
    }

    const notifications = await this.notificationsRepository.manager.transaction(
      async (manager) => {
        const recipients = await manager.getRepository(User).find({
          where: dto.sendToAll
            ? { status: UserStatus.ACTIVE }
            : { id: In(requestedIds), status: UserStatus.ACTIVE },
          order: { fullName: 'ASC' },
        });
        if (!dto.sendToAll && recipients.length !== requestedIds.length) {
          throw new BadRequestException(
            '部分接收人不存在、已停用或不是有效账号',
          );
        }
        if (recipients.length === 0) {
          throw new BadRequestException('当前没有可接收通知的启用账号');
        }

        const messageId = randomUUID();
        const created: Notification[] = [];
        for (const recipient of recipients) {
          const recipientId = String(recipient.id);
          created.push(await this.createNotification(manager, {
            recipientUserId: recipientId,
            notificationType: NotificationType.ADMIN_MESSAGE,
            title: dto.title,
            body: dto.body,
            relatedApplicationId: null,
            dedupeKey: `ADMIN_MESSAGE:${messageId}:${recipientId}`,
            senderUserId,
          }));
        }
        return created;
      },
    );

    this.pushAfterCommit(notifications);
    return {
      sentCount: notifications.length,
      recipientUserIds: notifications.map(
        (notification) => notification.recipientUserId,
      ),
    };
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationsRepository.findOne({
      where: { id, recipientUserId: userId },
    });
    if (!notification) {
      throw new NotFoundException('通知不存在');
    }
    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      const saved = await this.notificationsRepository.save(notification);
      await this.pushUnreadRefresh([userId]);
      return saved;
    }
    return notification;
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationsRepository.update(
      { recipientUserId: userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    await this.pushUnreadRefresh([userId]);
    return { updated: result.affected ?? 0 };
  }

  async listTodos(
    userId: string,
    query: ListTodosDto,
  ): Promise<PaginatedResult<TodoItem>> {
    const builder = this.todosRepository
      .createQueryBuilder('todo')
      .leftJoinAndSelect('todo.relatedApplication', 'application')
      .leftJoinAndSelect('application.asset', 'asset')
      .leftJoinAndSelect('application.applicant', 'applicant')
      .where('todo.assigneeUserId = :userId', { userId });
    if (query.status) {
      builder.andWhere('todo.status = :status', { status: query.status });
    }
    if (query.unreadOnly) {
      builder.andWhere('todo.isRead = :isRead', { isRead: false });
    }
    const [items, total] = await builder
      .orderBy('todo.createdAt', 'DESC')
      .skip(query.skip)
      .take(query.pageSize)
      .getManyAndCount();
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async markTodoRead(id: string, userId: string): Promise<TodoItem> {
    const todo = await this.todosRepository.findOne({
      where: { id, assigneeUserId: userId },
    });
    if (!todo) {
      throw new NotFoundException('待办不存在');
    }
    if (!todo.isRead) {
      todo.isRead = true;
      todo.readAt = new Date();
      const saved = await this.todosRepository.save(todo);
      await this.pushUnreadRefresh([userId]);
      return saved;
    }
    return todo;
  }

  async markAllTodosRead(userId: string): Promise<{ updated: number }> {
    const result = await this.todosRepository.update(
      { assigneeUserId: userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    await this.pushUnreadRefresh([userId]);
    return { updated: result.affected ?? 0 };
  }

  async createNotification(
    manager: EntityManager,
    input: NotificationInput,
  ): Promise<Notification> {
    const repository = manager.getRepository(Notification);
    return repository.save(repository.create({
      recipientUserId: input.recipientUserId,
      notificationType: input.notificationType,
      title: input.title,
      body: input.body,
      relatedApplicationId: input.relatedApplicationId,
      dedupeKey: input.dedupeKey ?? null,
      senderUserId: input.senderUserId ?? null,
      isRead: false,
      readAt: null,
    }));
  }

  async createTodo(manager: EntityManager, input: TodoInput): Promise<TodoItem> {
    const repository = manager.getRepository(TodoItem);
    return repository.save(repository.create({
      assigneeUserId: input.assigneeUserId,
      todoType: input.todoType,
      title: input.title,
      relatedApplicationId: input.relatedApplicationId,
      dedupeKey: input.dedupeKey,
      status: TodoStatus.PENDING,
      isRead: false,
      readAt: null,
      dueAt: input.dueAt ?? null,
      completedAt: null,
    }));
  }

  async createAdminWork(
    manager: EntityManager,
    input: {
      applicationId: string;
      applicationNo: string;
      assetName: string;
      applicantName: string;
      purpose: string;
      expectedReturnAt: Date;
      notificationType: NotificationType;
      notificationTitle: string;
      notificationBody: string;
      todoType: TodoType;
      todoTitle: string;
    },
  ): Promise<AdminWorkBatch> {
    const admins = await manager.getRepository(User).find({
      where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    });
    const notifications: Notification[] = [];
    const todos: TodoItem[] = [];

    for (const admin of admins) {
      const adminId = String(admin.id);
      notifications.push(await this.createNotification(manager, {
        recipientUserId: adminId,
        notificationType: input.notificationType,
        title: input.notificationTitle,
        body: input.notificationBody,
        relatedApplicationId: input.applicationId,
        dedupeKey: `${input.notificationType}:${input.applicationId}:${adminId}`,
      }));
      todos.push(await this.createTodo(manager, {
        assigneeUserId: adminId,
        todoType: input.todoType,
        title: input.todoTitle,
        relatedApplicationId: input.applicationId,
        dedupeKey: `${input.todoType}:${input.applicationId}:${adminId}`,
        dueAt: input.todoType === TodoType.HANDOVER
          ? input.expectedReturnAt
          : null,
      }));
    }
    return { notifications, todos };
  }

  async createAdminNotifications(
    manager: EntityManager,
    input: {
      applicationId: string;
      notificationType: NotificationType;
      title: string;
      body: string;
    },
  ): Promise<Notification[]> {
    const admins = await manager.getRepository(User).find({
      where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    });
    const notifications: Notification[] = [];
    for (const admin of admins) {
      const adminId = String(admin.id);
      notifications.push(await this.createNotification(manager, {
        recipientUserId: adminId,
        notificationType: input.notificationType,
        title: input.title,
        body: input.body,
        relatedApplicationId: input.applicationId,
        dedupeKey: `${input.notificationType}:${input.applicationId}:${adminId}`,
      }));
    }
    return notifications;
  }

  async completePendingTodos(
    manager: EntityManager,
    applicationId: string,
    todoType: TodoType,
  ): Promise<void> {
    await manager.getRepository(TodoItem).update(
      {
        relatedApplicationId: applicationId,
        todoType,
        status: TodoStatus.PENDING,
      },
      {
        status: TodoStatus.COMPLETED,
        completedAt: new Date(),
      },
    );
  }

  async cancelPendingTodos(
    manager: EntityManager,
    applicationId: string,
    todoType: TodoType,
  ): Promise<void> {
    await manager.getRepository(TodoItem).update(
      {
        relatedApplicationId: applicationId,
        todoType,
        status: TodoStatus.PENDING,
      },
      {
        status: TodoStatus.CANCELLED,
        completedAt: null,
      },
    );
  }

  pushAfterCommit(
    notifications: Notification[],
    todos: TodoItem[] = [],
  ): void {
    const affectedUserIds: string[] = [];
    for (const notification of notifications) {
      affectedUserIds.push(String(notification.recipientUserId));
      this.realtimeGateway.emitToUser(
        String(notification.recipientUserId),
        'notification.created',
        notification,
      );
    }
    for (const todo of todos) {
      affectedUserIds.push(String(todo.assigneeUserId));
      this.realtimeGateway.emitToUser(
        String(todo.assigneeUserId),
        'todo.created',
        todo,
      );
    }
    void this.pushUnreadRefresh(affectedUserIds).catch(() => undefined);
  }

  async pushUnreadRefresh(userIds: string[]): Promise<void> {
    for (const userId of [...new Set(userIds)]) {
      const [unreadNotifications, unreadTodos] = await Promise.all([
        this.unreadCount(userId),
        this.todosRepository.count({
          where: {
            assigneeUserId: userId,
            status: TodoStatus.PENDING,
            readAt: IsNull(),
          },
        }),
      ]);
      this.realtimeGateway.emitToUser(userId, 'unread.updated', {
        unreadNotifications,
        unreadTodos,
      });
    }
  }

  async pushTodoRefreshToAdmins(applicationId: string): Promise<void> {
    const admins = await this.notificationsRepository.manager.getRepository(User).find({
      where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    });
    for (const admin of admins) {
      this.realtimeGateway.emitToUser(
        String(admin.id),
        'todos.changed',
        { applicationId },
      );
    }
  }

  activeUserIds(users: User[]): string[] {
    return users.filter((user) => user.status === UserStatus.ACTIVE).map((user) => String(user.id));
  }
}
