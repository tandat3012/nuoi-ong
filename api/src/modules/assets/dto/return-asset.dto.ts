import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class ReturnAssetDto {
  @IsUUID() warehouseId!: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  locationId?: string;
  @IsOptional() @IsString() @MaxLength(4000) note?: string | null;
}
