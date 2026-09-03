import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const DECIMAL = /^(0|[1-9]\d{0,14})(\.\d{1,3})?$/;

export class CreateStockReceiptItemDto {
  @IsUUID()
  itemId!: string;

  @Matches(DECIMAL)
  quantity!: string;

  @IsOptional()
  @Matches(/^(0|[1-9]\d{0,15})(\.\d{1,2})?$/)
  unitPrice?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lotNumber?: string;

  @IsOptional()
  @IsDateString()
  manufacturedDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  assetCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  serialNumber?: string;
}

export class CreateStockReceiptDto {
  @IsUUID()
  warehouseId!: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string | null;

  @IsOptional()
  @IsDateString()
  receiptDate?: string;

  @IsString()
  @Length(1, 50)
  receiptCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStockReceiptItemDto)
  items!: CreateStockReceiptItemDto[];
}

export class ListStockReceiptsQueryDto {
  @IsOptional()
  @IsUUID()
  farmId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;
}
