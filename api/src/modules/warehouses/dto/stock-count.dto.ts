import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { DocumentNumberingOptionsDto } from './document-numbering.dto';
const DECIMAL = /^(0|[1-9]\d{0,14})(\.\d{1,3})?$/;
export class StockCountItemDto {
  @IsUUID() itemId!: string;
  @IsOptional() @IsUUID() lotId?: string | null;
  @IsOptional() @IsUUID() assetId?: string | null;
  @ApiProperty({
    example: '12.500',
    pattern: DECIMAL.source,
    description:
      'Số đếm không âm, tối đa 15 chữ số nguyên và 3 chữ số thập phân.',
  })
  @Matches(DECIMAL)
  actualQuantity!: string;
  @IsOptional() @IsString() @MaxLength(4000) note?: string | null;
}
export class CreateStockCountDto extends DocumentNumberingOptionsDto {
  @IsUUID() warehouseId!: string;
  // Legacy field: ignored, the code is assigned on confirmation.
  @ApiPropertyOptional({
    deprecated: true,
    description: 'Ignored. The permanent code is assigned on confirmation.',
  })
  @IsOptional()
  countCode?: unknown;
  @IsOptional() @IsString() @MaxLength(4000) note?: string | null;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockCountItemDto)
  items!: StockCountItemDto[];
}
export class UpdateStockCountDto extends DocumentNumberingOptionsDto {
  @IsOptional() @IsString() @MaxLength(4000) note?: string | null;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockCountItemDto)
  items?: StockCountItemDto[];
}
