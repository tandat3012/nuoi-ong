import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Zero allowed: a returned line may pass nothing, or nothing may be rejected.
const QUANTITY = /^(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?$/;

export class CreateIssueReturnItemDto {
  @ApiProperty({ format: 'uuid', description: 'Dòng của phiếu xuất nguồn.' })
  @IsUUID()
  issueItemId!: string;

  @ApiProperty({
    example: '8.000',
    description: 'Lượng đạt kiểm nhận, được cộng lại vào tồn khả dụng.',
  })
  @Matches(QUANTITY)
  acceptedQuantity!: string;

  @ApiPropertyOptional({
    example: '2.000',
    description: 'Lượng không đạt (hỏng/không dùng được), chỉ ghi nhận.',
  })
  @IsOptional()
  @Matches(QUANTITY)
  rejectedQuantity?: string;

  @ApiPropertyOptional({
    description: 'Bắt buộc khi rejectedQuantity > 0: lý do, tình trạng.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  rejectionReason?: string;
}

export class CreateIssueReturnDto {
  @ApiPropertyOptional({ format: 'date', example: '2026-11-08' })
  @IsOptional()
  @IsDateString()
  receiptDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateIssueReturnItemDto)
  items!: CreateIssueReturnItemDto[];
}
