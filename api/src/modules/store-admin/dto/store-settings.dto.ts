import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { storeRegion } from '../../../db/schema';

type StoreRegion = (typeof storeRegion.enumValues)[number];

export class UpdateStoreSettingsDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Kho bán hàng của trại; bỏ trống khi chưa chọn.',
  })
  @IsOptional()
  @IsUUID()
  salesWarehouseId?: string;

  @ApiProperty({
    description: 'Bật bán online; cần kho bán và ít nhất một miền.',
  })
  @IsBoolean()
  salesEnabled!: boolean;

  @ApiProperty({ enum: storeRegion.enumValues, isArray: true })
  @IsArray()
  @ArrayMaxSize(storeRegion.enumValues.length)
  @IsIn(storeRegion.enumValues, { each: true })
  regions!: StoreRegion[];

  @ApiPropertyOptional({
    format: 'uuid',
    isArray: true,
    description:
      'Kho làm việc của trại bù hàng cho kho bán; thay toàn bộ danh sách. Bỏ trống thì giữ nguyên.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  sourceWarehouseIds?: string[];
}

export class SetStoreVariantItemDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Vật tư của trại cung cấp quy cách này.',
  })
  @IsUUID()
  itemId!: string;
}
