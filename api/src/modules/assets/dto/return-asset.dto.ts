import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ReturnAssetDto {
  @IsUUID() warehouseId!: string;
  @IsOptional() @IsString() @MaxLength(4000) note?: string | null;
}
