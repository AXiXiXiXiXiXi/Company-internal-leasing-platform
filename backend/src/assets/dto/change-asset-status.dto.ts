import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { AssetStatus } from '../../common/enums';

export class ChangeAssetStatusDto {
  @ApiProperty({
    enum: [AssetStatus.AVAILABLE, AssetStatus.MAINTENANCE, AssetStatus.RETIRED],
  })
  @IsEnum(AssetStatus)
  status: AssetStatus;
}
