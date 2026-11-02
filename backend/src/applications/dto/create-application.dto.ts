import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNumberString,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateApplicationDto {
  @ApiProperty({ example: '1' })
  @IsNumberString()
  assetId: string;

  @ApiProperty({ example: '外场客户演示使用' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  purpose: string;

  @ApiProperty({ example: '2026-11-10T10:00:00.000Z' })
  @IsDateString()
  expectedReturnAt: string;
}
