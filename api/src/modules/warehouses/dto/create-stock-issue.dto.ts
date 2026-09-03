import { Type } from 'class-transformer';
import {
  IsArray, IsDateString, IsIn, IsOptional, IsString, IsUUID,
  Length, Matches, MaxLength, ValidateNested,
} from 'class-validator';

const DECIMAL = /^(0|[1-9]\d{0,14})(\.\d{1,3})?$/;
const ISSUE_TYPES = ['CONSUMPTION', 'DAMAGE', 'DISPOSAL', 'OTHER', 'MAINTENANCE'] as const;

export class CreateStockIssueItemDto {
  @IsUUID() itemId!: string;
  @Matches(DECIMAL) quantity!: string;
  @IsOptional() @IsUUID() lotId?: string | null;
  @IsOptional() @IsUUID() assetId?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) note?: string | null;
}

export class CreateStockIssueDto {
  @IsUUID() warehouseId!: string;
  @IsString() @Length(1, 50) issueCode!: string;
  @IsOptional() @IsDateString() issueDate?: string;
  @IsOptional() @IsIn(ISSUE_TYPES) issueType?: (typeof ISSUE_TYPES)[number];
  @IsOptional() @IsUUID() maintenanceRecordId?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) reason?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) note?: string | null;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CreateStockIssueItemDto)
  items!: CreateStockIssueItemDto[];
}
