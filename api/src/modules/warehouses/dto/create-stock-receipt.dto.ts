import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentNumberingOptionsDto } from './document-numbering.dto';

const DECIMAL = /^(?=.*[1-9])(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?$/;

export class CreateStockReceiptItemDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Khi sửa nháp: id của dòng hiện có mà dòng này thay thế, để giữ số lô cũ (legacyLotNumber). Bỏ trống với dòng mới.',
  })
  @IsOptional()
  @IsUUID()
  lineId?: string;

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
    format: 'uuid',
    description:
      'Nhập thêm vào lô đã có (cùng farm và mặt hàng LOT); khi đó bỏ trống supplierLotNumber, manufacturedDate, expiryDate.',
  })
  @IsOptional()
  @IsUUID()
  lotId?: string;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 100,
    example: 'BATCH-0425',
    description:
      'Số lô in trên hàng (nhà sản xuất/nhà cung cấp) cho dòng LOT tạo lô mới. Không bắt buộc, không duy nhất; mã lô nội bộ (lotCode) do hệ thống cấp khi xác nhận.',
  })
  @IsOptional()
  // Blank is stored as NULL; case, punctuation and leading zeros are kept.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString()
  @MaxLength(100)
  supplierLotNumber?: string | null;

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

export class CreateStockReceiptDto extends DocumentNumberingOptionsDto {
  @IsUUID()
  warehouseId!: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string | null;

  @ApiPropertyOptional({ format: 'date', example: '2026-10-08' })
  @IsOptional()
  @IsDateString()
  receiptDate?: string;

  // Legacy field: ignored, the code is assigned on confirmation.
  @ApiPropertyOptional({
    deprecated: true,
    description: 'Ignored. The permanent code is assigned on confirmation.',
  })
  @IsOptional()
  receiptCode?: unknown;

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
