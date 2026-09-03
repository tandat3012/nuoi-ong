import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

const SIGNED_DECIMAL = /^-?(0|[1-9]\d{0,14})(\.\d{1,3})?$/;

export class CreateInventoryAdjustmentDto {
  @IsUUID() warehouseId!: string;
  @IsUUID() itemId!: string;
  @IsOptional() @IsUUID() lotId?: string | null;
  @Matches(SIGNED_DECIMAL) quantityChange!: string;
  @IsString() @MaxLength(4000) reason!: string;
}
