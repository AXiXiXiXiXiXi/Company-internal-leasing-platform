import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAssetDto {
  @ApiProperty({ example: 'A-1004' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  assetNo: string;

  @ApiProperty({ example: 'ThinkPad X1 Carbon' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name: string;

  @ApiProperty({ example: '笔记本电脑' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  category: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 128 })
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  serialNo?: string | null;

  @ApiProperty({ example: 'A区-01柜' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  storageLocation: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 1000 })
  @Transform(({ value }) => (value === '' ? null : value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
