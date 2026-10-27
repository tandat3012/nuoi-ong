import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { locationType, recordStatus } from '../../../db/schema';

function normalizeCode({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

// Blank optional text is stored as NULL rather than an empty string.
function trimText({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;
  return value.trim() || null;
}

type RecordStatus = (typeof recordStatus.enumValues)[number];

export class CreateCategoryDto {
  @Transform(normalizeCode) @IsString() @Length(1, 50) code!: string;
  @Transform(trimText) @IsString() @Length(1, 255) name!: string;
  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  @IsOptional() @IsIn(recordStatus.enumValues) status?: RecordStatus;
}

export class CreateUnitDto {
  @Transform(normalizeCode) @IsString() @Length(1, 30) code!: string;
  @Transform(trimText) @IsString() @Length(1, 100) name!: string;
  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  symbol?: string | null;
}

export class UpdateUnitDto extends PartialType(CreateUnitDto) {
  @IsOptional() @IsIn(recordStatus.enumValues) status?: RecordStatus;
}

export class CreateSupplierDto {
  @Transform(normalizeCode) @IsString() @Length(1, 50) code!: string;
  @Transform(trimText) @IsString() @Length(1, 255) name!: string;
  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;
  @Transform(trimText)
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string | null;
  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  address?: string | null;
  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string | null;
}

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {
  @IsOptional() @IsIn(recordStatus.enumValues) status?: RecordStatus;
}

export class CreateLocationDto {
  @Transform(normalizeCode) @IsString() @Length(1, 50) code!: string;
  @Transform(trimText) @IsString() @Length(1, 255) name!: string;
  @IsIn(locationType.enumValues)
  type!: (typeof locationType.enumValues)[number];
  @IsOptional() @IsUUID() warehouseId?: string | null;
  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;
}

export class UpdateLocationDto extends PartialType(CreateLocationDto) {
  @IsOptional() @IsIn(recordStatus.enumValues) status?: RecordStatus;
}
