import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { IsVndAmount } from '../../../common/money';
import { trimText } from '../../materials/dto/material-validation';

// numeric(18,0) VND; reject fractional dong before PostgreSQL rounds it.
const PRICE_PATTERN = /^(0|[1-9]\d{0,17})$/;
// numeric(18,3); positivity is enforced by ck_store_product_variants_quantity_step.
const STEP_PATTERN = /^(0|[1-9]\d{0,14})(\.\d{1,3})?$/;

export class CreateStoreVariantDto {
  @IsUUID()
  itemId!: string;

  @ApiProperty({ example: 'Chai 500ml' })
  @Transform(trimText)
  @IsString()
  @Length(1, 255)
  name!: string;

  @ApiProperty({ example: '150000', pattern: PRICE_PATTERN.source })
  @IsString()
  @Matches(PRICE_PATTERN)
  @IsVndAmount()
  price!: string;

  @ApiPropertyOptional({ example: '1', pattern: STEP_PATTERN.source })
  @IsOptional()
  @IsString()
  @Matches(STEP_PATTERN)
  quantityStep?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateStoreVariantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional({ pattern: PRICE_PATTERN.source })
  @IsOptional()
  @IsString()
  @Matches(PRICE_PATTERN)
  @IsVndAmount()
  price?: string;

  @ApiPropertyOptional({ pattern: STEP_PATTERN.source })
  @IsOptional()
  @IsString()
  @Matches(STEP_PATTERN)
  quantityStep?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
