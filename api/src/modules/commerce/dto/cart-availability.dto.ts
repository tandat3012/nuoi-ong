import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { storeRegion } from '../../../db/schema';

export class CartAvailabilityLineDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  variantId!: string;

  @ApiProperty({ minimum: 1, maximum: 10000, description: 'Số bước bán.' })
  @IsInt()
  @Min(1)
  @Max(10000)
  quantity!: number;
}

export class CartAvailabilityDto {
  @ApiProperty({ enum: storeRegion.enumValues })
  @IsIn(storeRegion.enumValues)
  region!: (typeof storeRegion.enumValues)[number];

  @ApiProperty({ type: [CartAvailabilityLineDto], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((line: CartAvailabilityLineDto) =>
    typeof line?.variantId === 'string'
      ? line.variantId.toLowerCase()
      : line?.variantId,
  )
  @ValidateNested({ each: true })
  @Type(() => CartAvailabilityLineDto)
  items!: CartAvailabilityLineDto[];
}
