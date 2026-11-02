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
import { ListLoansDto } from './dto/list-loans.dto';
import { ReturnLoanDto } from './dto/return-loan.dto';
import { LoansService } from './loans.service';

@ApiTags('实际借还')
@ApiBearerAuth()
@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Get()
  @ApiOperation({
    summary: '查询借还记录；员工只返回自己的，管理员可查当前、逾期和历史',
  })
  list(
    @Query() query: ListLoansDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.loansService.list(query, actor);
  }

  @Get(':id')
  @ApiOperation({ summary: '查看借用记录详情' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.loansService.findOne(id, actor);
  }

  @Post(':id/return')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: '管理员登记实际归还并释放资产' })
  returnLoan(
    @Param('id') id: string,
    @Body() dto: ReturnLoanDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.loansService.returnLoan(id, dto, actor);
  }
}
