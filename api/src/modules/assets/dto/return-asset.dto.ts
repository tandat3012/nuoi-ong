import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class ReturnAssetDto {
  @IsUUID() warehouseId!: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  locationId?: string;
  @ApiProperty({
    enum: ['GOOD', 'DAMAGED'],
    description:
      'Kết quả kiểm nhận: GOOD về AVAILABLE; DAMAGED vẫn nằm kho nhưng không cấp phát/bán được.',
  })
  @IsIn(['GOOD', 'DAMAGED'])
  condition!: 'GOOD' | 'DAMAGED';
  @IsOptional() @IsString() @MaxLength(4000) note?: string | null;
}
