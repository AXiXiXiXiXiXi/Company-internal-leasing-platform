import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { AuthenticatedUser } from '../common/types';
import { AssetsService } from './assets.service';
import { ChangeAssetStatusDto } from './dto/change-asset-status.dto';
import { CreateAssetDto } from './dto/create-asset.dto';
import { ListAssetsDto } from './dto/list-assets.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@ApiTags('资产管理')
@ApiBearerAuth()
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @ApiOperation({ summary: '查询资产台账（员工可查看）' })
  list(@Query() query: ListAssetsDto) {
    return this.assetsService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '查看资产详情' })
  findOne(@Param('id') id: string) {
    return this.assetsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '管理员创建资产' })
  create(
    @Body() dto: CreateAssetDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.assetsService.create(dto, actor.id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '管理员修改资产基础信息' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAssetDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.assetsService.update(id, dto, actor.id);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '管理员设置维修中、已报废或恢复可借' })
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeAssetStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    this.assetsService.validateRequestedStatus(dto.status);
    return this.assetsService.changeStatus(id, dto, actor.id);
  }
}
