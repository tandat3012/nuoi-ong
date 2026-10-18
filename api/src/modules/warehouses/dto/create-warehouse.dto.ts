import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

function normalizeCode({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

function trimText({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateWarehouseDto {
  @Transform(normalizeCode)
  @IsString()
  @Length(1, 50)
  code!: string;

  @Transform(trimText)
  @IsString()
  @Length(1, 255)
  name!: string;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  address?: string | null;

  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;
}
