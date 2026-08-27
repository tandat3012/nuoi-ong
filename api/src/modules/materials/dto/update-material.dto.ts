import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { materialKind, recordStatus } from '../../../db/schema';
import {
  materialTrackingModes,
  normalizeCode,
  trimText,
} from './material-validation';

export class UpdateMaterialDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @Transform(normalizeCode)
  @IsString()
  @Length(1, 50)
  code?: string;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @Length(1, 255)
  name?: string;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @IsOptional()
  @IsIn(materialTrackingModes)
  trackingMode?: (typeof materialTrackingModes)[number];

  @IsOptional()
  @IsString()
  @Matches(/^(0|[1-9]\d{0,14})(\.\d{1,3})?$/)
  minStockLevel?: string;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(255)
  barcode?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  imageUrl?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  sourceUrl?: string | null;

  @IsOptional()
  @IsIn(recordStatus.enumValues)
  status?: (typeof recordStatus.enumValues)[number];

  @IsOptional()
  @IsIn(materialKind.enumValues)
  kind?: (typeof materialKind.enumValues)[number];

  @IsOptional()
  @IsBoolean()
  requiresExpiryTracking?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  expiryWarningDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36500)
  defaultShelfLifeDays?: number | null;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(4000)
  storageInstructions?: string | null;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(4000)
  safetyNotes?: string | null;
}
