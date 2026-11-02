import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Body,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { AuthenticatedUser } from '../common/types';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { ListTodosDto } from './dto/list-todos.dto';
import { NotificationsService } from './notifications.service';
import { SendNotificationDto } from './dto/send-notification.dto';

@ApiTags('通知与待办')
@ApiBearerAuth()
@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('notifications')
  @ApiOperation({ summary: '查询自己的通知' })
  listNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListNotificationsDto,
  ) {
    return this.notificationsService.list(user.id, query);
  }

  @Get('notifications/unread-count')
  @ApiOperation({ summary: '查询自己的未读通知数量' })
  async unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return { count: await this.notificationsService.unreadCount(user.id) };
  }

  @Post('notifications/send')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '管理员发送手动站内通知' })
  sendNotification(
    @Body() dto: SendNotificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationsService.sendAdminMessage(user.id, dto);
  }

  @Patch('notifications/:id/read')
  @ApiOperation({ summary: '将一条通知标记为已读' })
  markNotificationRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationsService.markRead(id, user.id);
  }

  @Patch('notifications/read-all')
  @ApiOperation({ summary: '将所有通知标记为已读' })
  markAllNotificationsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Get('todos')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '管理员查询自己的待办' })
  listTodos(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTodosDto,
  ) {
    return this.notificationsService.listTodos(user.id, query);
  }

  @Patch('todos/:id/read')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '将一条待办标记为已读' })
  markTodoRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationsService.markTodoRead(id, user.id);
  }

  @Patch('todos/read-all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '将所有待办标记为已读' })
  markAllTodosRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllTodosRead(user.id);
  }
}
