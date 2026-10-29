import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsVndAmount } from '../../../common/money';
import { trimText } from '../../materials/dto/material-validation';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StoreOrderLineDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  variantId!: string;

  @ApiProperty({
    minimum: 1,
    maximum: 10000,
    description: 'Số bước bán, không phải lượng xuất kho.',
  })
  @IsInt()
  @Min(1)
  @Max(10000)
  quantity!: number;

  @ApiPropertyOptional({
    example: '185000',
    description: 'Giá khách đã xem; giá thay đổi trả 409 để xác nhận lại.',
  })
  @IsOptional()
  @IsVndAmount()
  expectedUnitPrice?: string;
}

export class CreateStoreOrderDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Giữ nguyên khi thử lại cùng một lần đặt hàng.',
  })
  @IsUUID()
  idempotencyKey!: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trimText)
  @IsString()
  @Length(1, 255)
  recipientName!: string;

  @Transform(trimText)
  @IsString()
  @Length(8, 30)
  @ApiProperty({ example: '0901234567' })
  @Matches(/^\+?[\d ()-]+$/)
  phone!: string;

  @Transform(trimText)
  @IsString()
  @Length(5, 2000)
  @ApiProperty({ maxLength: 2000 })
  address!: string;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @Length(0, 2000)
  @ApiPropertyOptional({ maxLength: 2000 })
  note?: string;

  @ApiProperty({ enum: ['COD', 'BANK_TRANSFER'] })
  @IsIn(['COD', 'BANK_TRANSFER'])
  paymentMethod!: 'COD' | 'BANK_TRANSFER';

  @ApiProperty({ type: [StoreOrderLineDto], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((line: StoreOrderLineDto) =>
    typeof line?.variantId === 'string'
      ? line.variantId.toLowerCase()
      : line?.variantId,
  )
  @ValidateNested({ each: true })
  @Type(() => StoreOrderLineDto)
  items!: StoreOrderLineDto[];
}

export class StoreOrderShippingFeeDto {
  @ApiProperty({
    example: '30000',
    description: 'Chỉ sửa khi đơn PENDING và UNPAID.',
  })
  @IsVndAmount()
  shippingFee!: string;
}

export class CancelStoreOrderDto {
  @ApiProperty({ maxLength: 1000 })
  @Transform(trimText)
  @IsString()
  @Length(1, 1000)
  reason!: string;
}
