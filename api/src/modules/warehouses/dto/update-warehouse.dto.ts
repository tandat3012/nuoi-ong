import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { recordStatus } from '../../../db/schema';

function normalizeCode({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

function trimText({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateWarehouseDto {
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
  address?: string | null;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @IsOptional()
  @IsIn(recordStatus.enumValues)
  status?: (typeof recordStatus.enumValues)[number];
}
