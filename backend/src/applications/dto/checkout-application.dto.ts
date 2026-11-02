import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CheckoutApplicationDto {
  @ApiPropertyOptional({
    description: '实际借出时间；不传则使用服务器当前时间',
    example: '2026-11-02T08:30:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  checkedOutAt?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  handoverNote?: string;
}
