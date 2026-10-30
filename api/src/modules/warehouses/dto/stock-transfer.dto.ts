import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { DocumentNumberingOptionsDto } from './document-numbering.dto';
const DECIMAL = /^(?=.*[1-9])(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?$/;
export class StockTransferItemDto {
  @IsUUID() itemId!: string;
  @ApiProperty({
    example: '5.000',
    pattern: DECIMAL.source,
    description:
      'Số lượng chuyển dương, tối đa 15 chữ số nguyên và 3 chữ số thập phân.',
  })
  @Matches(DECIMAL)
  quantity!: string;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Dùng với mặt hàng theo dõi LOT.',
  })
  @IsOptional()
  @IsUUID()
  lotId?: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Dùng với mặt hàng theo dõi ASSET; số lượng mỗi tài sản là 1.',
  })
  @IsOptional()
  @IsUUID()
  assetId?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) note?: string | null;
}
export class CreateStockTransferDto extends DocumentNumberingOptionsDto {
  @IsUUID() fromWarehouseId!: string;
  @IsUUID() toWarehouseId!: string;
  // Legacy field: ignored, the code is assigned on confirmation.
  @ApiPropertyOptional({
    deprecated: true,
    description: 'Ignored. The permanent code is assigned on confirmation.',
  })
  @IsOptional()
  transferCode?: unknown;
  @ApiPropertyOptional({ format: 'date', example: '2026-10-08' })
  @IsOptional()
  @IsDateString()
  transferDate?: string;
  @IsOptional() @IsString() @MaxLength(4000) note?: string | null;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockTransferItemDto)
  items!: StockTransferItemDto[];
}
export class UpdateStockTransferDto extends DocumentNumberingOptionsDto {
  @IsOptional() @IsUUID() fromWarehouseId?: string;
  @IsOptional() @IsUUID() toWarehouseId?: string;
  // Legacy field: ignored, the code is assigned on confirmation.
  @ApiPropertyOptional({
    deprecated: true,
    description: 'Ignored. The permanent code is assigned on confirmation.',
  })
  @IsOptional()
  transferCode?: unknown;
  @ApiPropertyOptional({ format: 'date', example: '2026-10-08' })
  @IsOptional()
  @IsDateString()
  transferDate?: string;
  @IsOptional() @IsString() @MaxLength(4000) note?: string | null;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockTransferItemDto)
  items?: StockTransferItemDto[];
}
