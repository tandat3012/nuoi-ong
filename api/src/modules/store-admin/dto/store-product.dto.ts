import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { storeProductStatus } from '../../../db/schema';
import { trimText } from '../../materials/dto/material-validation';

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class CreateStoreProductDto {
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: 'Mật ong hoa nhãn' })
  @Transform(trimText)
  @IsString()
  @Length(1, 255)
  name!: string;

  @ApiProperty({ example: 'mat-ong-hoa-nhan' })
  @IsString()
  @MaxLength(255)
  @Matches(SLUG_PATTERN)
  slug!: string;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(10000)
  description?: string;
}

export class UpdateStoreProductDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(SLUG_PATTERN)
  slug?: string;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(10000)
  description?: string;
}

export class UpdateStoreProductStatusDto {
  @ApiProperty({ enum: storeProductStatus.enumValues })
  @IsIn(storeProductStatus.enumValues)
  status!: (typeof storeProductStatus.enumValues)[number];
}
