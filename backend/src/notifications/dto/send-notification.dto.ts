import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SendNotificationDto {
  @ApiProperty({ example: '周五设备盘点提醒' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title: string;

  @ApiProperty({
    example: '请各位同事在本周五下班前检查名下设备，并确认归还状态。',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;

  @ApiPropertyOptional({
    default: false,
    description: '为 true 时发送给全部启用账号，忽略 recipientUserIds',
  })
  @IsOptional()
  @IsBoolean()
  sendToAll = false;

  @ApiPropertyOptional({
    type: [String],
    description: '指定接收人 ID；sendToAll 为 false 时至少一名',
    example: ['2'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsNumberString({}, { each: true })
  recipientUserIds?: string[];
}
