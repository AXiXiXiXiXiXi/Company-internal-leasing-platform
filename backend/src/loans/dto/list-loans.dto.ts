import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export enum LoanView {
  ACTIVE = 'active',
  RETURNED = 'returned',
  ALL = 'all',
}

export class ListLoansDto extends PaginationDto {
  @ApiPropertyOptional({ enum: LoanView, default: LoanView.ALL })
  @IsOptional()
  @IsEnum(LoanView)
  view: LoanView = LoanView.ALL;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') {
      return true;
    }
    if (value === false || value === 'false') {
      return false;
    }
    return value;
  })
  @IsBoolean()
  overdueOnly = false;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  assetId?: string;

  @ApiPropertyOptional({ description: '管理员可按借用人筛选' })
  @IsOptional()
  @IsNumberString()
  applicantId?: string;

  @ApiPropertyOptional({ description: '申请编号、资产编号、资产名称或借用人姓名' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  q?: string;
}
