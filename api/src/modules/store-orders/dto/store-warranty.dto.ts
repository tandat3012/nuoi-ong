import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { IsVndAmount } from '../../../common/money';
import { storeWarrantyKind } from '../../../db/schema';
import { trimText } from '../../materials/dto/material-validation';

export class CreateStoreWarrantyDto {
  @IsUUID() orderId!: string;
  @ApiProperty({ format: 'uuid', description: 'Dòng đơn (thiết bị/dụng cụ).' })
  @IsUUID()
  orderItemId!: string;
  @ApiProperty({
    example: 1,
    description: 'Không vượt số đã mua trừ yêu cầu đang mở.',
  })
  @IsInt()
  @Min(1)
  @Max(10000)
  quantity!: number;
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Bắt buộc với hàng theo dõi tài sản: đúng cá thể đơn (hoặc phiếu đổi bảo hành) đã giao; khi đó quantity = 1.',
  })
  @IsOptional()
  @IsUUID()
  assetId?: string;
  @ApiProperty({ enum: storeWarrantyKind.enumValues })
  @IsIn(storeWarrantyKind.enumValues)
  kind!: (typeof storeWarrantyKind.enumValues)[number];
  @Transform(trimText) @IsString() @Length(1, 4000) issueDescription!: string;
  @ApiPropertyOptional({
    description: 'Cách nhận sản phẩm thực tế (bằng chứng).',
  })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @Length(1, 4000)
  intakeNote?: string;
}

export const warrantyActions = [
  'send',
  'quote',
  'decide',
  'start-repair',
  'back',
  'return',
  'exchange',
  'close',
  'cancel',
] as const;
export type WarrantyAction = (typeof warrantyActions)[number];

/** One step of a request; the service says which fields each step needs. */
export class StoreWarrantyActionDto {
  @ApiProperty({ enum: warrantyActions })
  @IsIn(warrantyActions)
  action!: WarrantyAction;
  @ApiPropertyOptional({ description: 'send: đối tác sửa chữa.' })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @Length(1, 255)
  partnerName?: string;
  @ApiPropertyOptional({
    example: '350000',
    description: 'quote: báo giá cho khách (VND).',
  })
  @IsOptional()
  @IsVndAmount()
  quoteAmount?: string;
  @ApiPropertyOptional({
    description: 'decide: khách đồng ý (true) hay từ chối (false).',
  })
  @IsOptional()
  @IsBoolean()
  approved?: boolean;
  @ApiPropertyOptional({ description: 'back: kết quả đối tác báo.' })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @Length(1, 4000)
  result?: string;
  @ApiPropertyOptional({
    example: '320000',
    description: 'back: chi phí thực tế (chỉ sửa có phí đã được đồng ý).',
  })
  @IsOptional()
  @IsVndAmount()
  actualCost?: string;
  @ApiPropertyOptional({
    description: 'decide/return/cancel: ghi chú hoặc lý do.',
  })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @Length(1, 4000)
  note?: string;
}
