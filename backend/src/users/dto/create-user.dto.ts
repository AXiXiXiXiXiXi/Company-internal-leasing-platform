import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../common/enums';

export class CreateUserDto {
  @ApiProperty({ example: 'lisi' })
  @IsString()
  @Matches(/^[A-Za-z0-9._-]{3,64}$/, {
    message: '用户名只能包含字母、数字、点、下划线和短横线，长度为 3-64',
  })
  username: string;

  @ApiPropertyOptional({ type: String, example: 'EMP003', nullable: true })
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  employeeNo?: string | null;

  @ApiProperty({ example: '李四' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  fullName: string;

  @ApiProperty({ enum: UserRole, example: UserRole.EMPLOYEE })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiProperty({ minLength: 8, maxLength: 128, example: 'temporary-password' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
