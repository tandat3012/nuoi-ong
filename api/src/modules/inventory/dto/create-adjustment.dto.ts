import { Transform, type TransformFnParams } from 'class-transformer';
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
  @IsOptional() @IsUUID() lotId?: string | null;
  @IsString()
  @Matches(SIGNED_DECIMAL)
  quantityChange!: string;
  @Transform(trimReason)
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  reason!: string;
}
