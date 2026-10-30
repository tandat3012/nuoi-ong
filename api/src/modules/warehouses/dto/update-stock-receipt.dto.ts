import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateStockReceiptItemDto } from './create-stock-receipt.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentNumberingOptionsDto } from './document-numbering.dto';

export class UpdateStockReceiptDto extends DocumentNumberingOptionsDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStockReceiptItemDto)
  items?: CreateStockReceiptItemDto[];
}
