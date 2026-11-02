import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { AuthenticatedUser } from '../common/types';
import { ApplicationsService } from './applications.service';
import { ApproveApplicationDto } from './dto/approve-application.dto';
import { CheckoutApplicationDto } from './dto/checkout-application.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ListApplicationsDto } from './dto/list-applications.dto';
import { RejectApplicationDto } from './dto/reject-application.dto';

@ApiTags('借用申请')
@ApiBearerAuth()
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  @ApiOperation({ summary: '查询申请；员工只返回自己的申请' })
  list(
    @Query() query: ListApplicationsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.applicationsService.list(query, actor);
  }

  @Get(':id')
  @ApiOperation({ summary: '查看申请详情' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.applicationsService.findOne(id, actor);
  }

  @Get(':id/events')
  @ApiOperation({ summary: '查看申请完整操作轨迹' })
  events(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.applicationsService.events(id, actor);
  }

  @Post()
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: '员工提交借用申请' })
  create(
    @Body() dto: CreateApplicationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.applicationsService.create(dto, actor);
  }

  @Post(':id/cancel')
  @Roles(UserRole.EMPLOYEE)
  @HttpCode(200)
  @ApiOperation({ summary: '员工取消自己尚未审批的申请' })
  cancel(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.applicationsService.cancel(id, actor);
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: '管理员批准申请并预留资产' })
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveApplicationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.applicationsService.approve(id, dto, actor);
  }

  @Post(':id/reject')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: '管理员驳回申请' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectApplicationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.applicationsService.reject(id, dto, actor);
  }

  @Post(':id/checkout')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: '管理员确认实际交接并登记借出' })
  checkout(
    @Param('id') id: string,
    @Body() dto: CheckoutApplicationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.applicationsService.checkout(id, dto, actor);
  }
}
