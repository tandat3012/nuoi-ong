import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const DECIMAL = /^(?=.*[1-9])(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?$/;
const ISSUE_TYPES = [
  'CONSUMPTION',
  'DAMAGE',
  'DISPOSAL',
  'OTHER',
  'MAINTENANCE',
] as const;

export class CreateStockIssueItemDto {
  @IsUUID() itemId!: string;
  @ApiProperty({
    example: '2.500',
    pattern: DECIMAL.source,
    description:
      'Số lượng xuất dương, tối đa 15 chữ số nguyên và 3 chữ số thập phân.',
  })
  @Matches(DECIMAL, {
    message: 'quantity must be greater than zero with at most 3 decimal places',
  })
  quantity!: string;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Bắt buộc với trackingMode LOT; không dùng cho QUANTITY.',
  })
  @IsOptional()
  @IsUUID()
  lotId?: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Bắt buộc với trackingMode ASSET; số lượng mỗi tài sản là 1.',
  })
  @IsOptional()
  @IsUUID()
  assetId?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) note?: string | null;
}

export class CreateStockIssueDto {
  @IsUUID() warehouseId!: string;
  @IsString() @Length(1, 50) issueCode!: string;
  @ApiPropertyOptional({ format: 'date', example: '2026-10-08' })
  @IsOptional()
  @IsDateString()
  issueDate?: string;
  @IsOptional() @IsIn(ISSUE_TYPES) issueType?: (typeof ISSUE_TYPES)[number];
  @IsOptional() @IsUUID() maintenanceRecordId?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) reason?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) note?: string | null;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStockIssueItemDto)
  items!: CreateStockIssueItemDto[];
}
