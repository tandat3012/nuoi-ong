import { Transform, type TransformFnParams } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { adjustmentReason } from '../../../db/schema';

export const SIGNED_DECIMAL =
  /^(?:[+-]?(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?)(?![\s\S])/;

export type AdjustmentReasonCode = (typeof adjustmentReason.enumValues)[number];

function trimText(params: TransformFnParams): unknown {
  const value: unknown = params.value;
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateInventoryAdjustmentDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Khóa do client sinh một lần cho mỗi lần điều chỉnh và giữ nguyên khi gửi lại; gửi trùng khóa sẽ trả lại bản ghi cũ thay vì điều chỉnh thêm lần nữa.',
  })
  @IsUUID()
  idempotencyKey!: string;

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

  @ApiProperty({ enum: adjustmentReason.enumValues, example: 'SHRINKAGE' })
  @IsIn(adjustmentReason.enumValues)
  reasonCode!: AdjustmentReasonCode;

  @ApiPropertyOptional({
    example: 'Hao hụt khi kiểm kê cuối ngày',
    description:
      'Ghi chú, được cắt khoảng trắng đầu/cuối, tối đa 4000 ký tự. Bắt buộc khi reasonCode là OTHER.',
  })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(4000)
  note?: string;
}

export class RejectInventoryAdjustmentDto {
  @ApiProperty({ example: 'Số liệu kiểm kê chưa khớp, cần đếm lại.' })
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}
