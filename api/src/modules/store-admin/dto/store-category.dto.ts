import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { trimText } from '../../materials/dto/material-validation';
import { SLUG_PATTERN } from './store-product.dto';

export class CreateStoreCategoryDto {
  @ApiProperty({ example: 'Mật ong' })
  @Transform(trimText)
  @IsString()
  @Length(1, 255)
  name!: string;

  @ApiProperty({ example: 'mat-ong' })
  @IsString()
  @MaxLength(100)
  @Matches(SLUG_PATTERN)
  slug!: string;
}

export class UpdateStoreCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(SLUG_PATTERN)
  slug?: string;
}
