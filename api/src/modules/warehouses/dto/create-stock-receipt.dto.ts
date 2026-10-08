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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const DECIMAL = /^(?=.*[1-9])(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?$/;

export class CreateStockReceiptItemDto {
  @IsUUID()
  itemId!: string;

  @ApiProperty({
    example: '10.000',
    pattern: DECIMAL.source,
    description:
      'Số lượng dương, tối đa 15 chữ số nguyên và 3 chữ số thập phân.',
  })
  @Matches(DECIMAL)
  quantity!: string;

  @ApiPropertyOptional({
    example: '25000.00',
    pattern: '^(0|[1-9]\\d{0,15})(\\.\\d{1,2})?$',
  })
  @IsOptional()
  @Matches(/^(0|[1-9]\d{0,15})(\.\d{1,2})?$/)
  unitPrice?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string | null;

  @ApiPropertyOptional({
    description:
      'Bắt buộc khi xác nhận dòng trackingMode LOT; dòng nháp có thể bỏ trống.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lotNumber?: string;

  @ApiPropertyOptional({ format: 'date', example: '2026-01-15' })
  @IsOptional()
  @IsDateString()
  manufacturedDate?: string;

  @ApiPropertyOptional({ format: 'date', example: '2027-01-15' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({
    description:
      'Bắt buộc khi xác nhận dòng trackingMode ASSET (quantity phải bằng 1).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  assetCode?: string;

  @ApiPropertyOptional({
    description: 'Số sê-ri cho dòng mặt hàng theo dõi ASSET.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  serialNumber?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Chỉ dùng với dòng mặt hàng theo dõi ASSET.',
  })
  @IsOptional()
  @IsUUID()
  locationId?: string;
}

export class CreateStockReceiptDto {
  @IsUUID()
  warehouseId!: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string | null;

  @ApiPropertyOptional({ format: 'date', example: '2026-10-08' })
  @IsOptional()
  @IsDateString()
  receiptDate?: string;

  @ApiProperty({ example: 'RCV-2026-001' })
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
