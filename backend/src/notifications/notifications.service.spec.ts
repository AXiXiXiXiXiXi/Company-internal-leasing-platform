import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { NotificationType, UserRole, UserStatus } from '../common/enums';
import { Notification, TodoItem, User } from '../database/entities';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from './notifications.service';

describe('NotificationsService manual messages', () => {
  function buildService(recipients: User[]) {
    let id = 0;
    const usersRepository = {
      find: jest.fn().mockResolvedValue(recipients),
    };
    const notificationsRepository: {
      create: jest.Mock;
      save: jest.Mock;
      count: jest.Mock;
      manager: { transaction: jest.Mock };
    } = {
      create: jest.fn((value) => ({ ...value, id: String(++id) })),
      save: jest.fn(async (value) => value),
      count: jest.fn().mockResolvedValue(1),
      manager: {
        transaction: jest.fn(),
      },
    };
    const manager: { getRepository: jest.Mock } = {
      getRepository: jest.fn((entity: unknown) => (
        entity === User ? usersRepository : notificationsRepository
      )),
    };
    notificationsRepository.manager.transaction.mockImplementation(
      async (
        callback: (transactionManager: typeof manager) => Promise<unknown>,
      ) => callback(manager),
    );
    const todosRepository = {
      count: jest.fn().mockResolvedValue(0),
    };
    const gateway = {
      emitToUser: jest.fn(),
    };

    return {
      service: new NotificationsService(
        notificationsRepository as unknown as Repository<Notification>,
        todosRepository as unknown as Repository<TodoItem>,
        gateway as unknown as RealtimeGateway,
      ),
      notificationsRepository,
      gateway,
    };
  }

  const recipients = [
    {
      id: '1',
      username: 'admin01',
      fullName: '超级管理员',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
    {
      id: '2',
      username: 'zhangsan',
      fullName: '张三',
      role: UserRole.EMPLOYEE,
      status: UserStatus.ACTIVE,
    },
  ] as User[];

  it('creates one persisted admin message per active recipient', async () => {
    const { service, notificationsRepository } = buildService(recipients);

    const result = await service.sendAdminMessage('1', {
      title: '测试通知',
      body: '通知内容',
      sendToAll: true,
      recipientUserIds: [],
    });

    expect(result.sentCount).toBe(2);
    expect(notificationsRepository.create).toHaveBeenCalledTimes(2);
    expect(notificationsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationType: NotificationType.ADMIN_MESSAGE,
        senderUserId: '1',
        title: '测试通知',
        body: '通知内容',
      }),
    );
  });

  it('rejects a recipient list containing unavailable users', async () => {
    const { service } = buildService([recipients[0]]);

    await expect(service.sendAdminMessage('1', {
      title: '测试通知',
      body: '通知内容',
      sendToAll: false,
      recipientUserIds: ['1', '2'],
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
