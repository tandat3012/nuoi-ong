import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { trimText } from '../../materials/dto/material-validation';

export class UpdateStoreImageDto {
  @ApiProperty({ example: 'Chai mật ong hoa nhãn 500ml' })
  @Transform(trimText)
  @IsString()
  @MaxLength(500)
  alt!: string;
}

export class ReorderStoreImagesDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  imageIds!: string[];
}
