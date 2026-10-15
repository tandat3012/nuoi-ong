import { Transform, type TransformFnParams } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const SIGNED_DECIMAL =
  /^(?:[+-]?(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?)(?![\s\S])/;

function trimReason(params: TransformFnParams): unknown {
  const value: unknown = params.value;
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateInventoryAdjustmentDto {
  @IsUUID() warehouseId!: string;
  @IsUUID() itemId!: string;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Bắt buộc với mặt hàng trackingMode LOT; phải bỏ trống với QUANTITY. Mặt hàng ASSET không hỗ trợ điều chỉnh.',
  })
  @IsOptional()
  @IsUUID()
  lotId?: string | null;
  @ApiProperty({
    example: '-2.500',
    pattern: SIGNED_DECIMAL.source,
    description:
      'Số thập phân có dấu, khác 0, tối đa 15 chữ số nguyên và 3 chữ số thập phân.',
  })
  @IsString()
  @Matches(SIGNED_DECIMAL)
  quantityChange!: string;

  @ApiProperty({
    example: 'Hao hụt khi kiểm kê cuối ngày',
    description:
      'Được cắt khoảng trắng đầu/cuối trước khi kiểm tra độ dài 1–4000.',
  })
  @Transform(trimReason)
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  reason!: string;
}
