import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ApplicationStatus } from '../../common/enums';

export class ListApplicationsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ApplicationStatus })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  assetId?: string;

  @ApiPropertyOptional({ description: '管理员可按申请人筛选' })
  @IsOptional()
  @IsNumberString()
  applicantId?: string;

  @ApiPropertyOptional({ description: '申请编号关键字' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  q?: string;
}
