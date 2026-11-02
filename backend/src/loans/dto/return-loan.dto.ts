import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReturnLoanDto {
  @ApiPropertyOptional({
    description: '实际归还时间；不传则使用服务器当前时间',
    example: '2026-11-09T09:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  returnedAt?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  returnNote?: string;
}
