import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, IsUUID, Length, Matches, MaxLength, ValidateNested } from 'class-validator';
const DECIMAL = /^(0|[1-9]\d{0,14})(\.\d{1,3})?$/;
export class StockCountItemDto { @IsUUID() itemId!: string; @IsOptional() @IsUUID() lotId?: string | null; @IsOptional() @IsUUID() assetId?: string | null; @Matches(DECIMAL) actualQuantity!: string; @IsOptional() @IsString() @MaxLength(4000) note?: string | null; }
export class CreateStockCountDto { @IsUUID() warehouseId!: string; @IsString() @Length(1, 50) countCode!: string; @IsOptional() @IsString() @MaxLength(4000) note?: string | null; @IsArray() @ValidateNested({ each: true }) @Type(() => StockCountItemDto) items!: StockCountItemDto[]; }
export class UpdateStockCountDto { @IsOptional() @IsString() @MaxLength(4000) note?: string | null; @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => StockCountItemDto) items?: StockCountItemDto[]; }
