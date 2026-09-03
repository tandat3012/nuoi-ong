import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsOptional, IsString, IsUUID, Length, MaxLength, ValidateNested } from 'class-validator';
import { CreateStockIssueItemDto } from './create-stock-issue.dto';

export class UpdateStockIssueDto {
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsOptional() @IsString() @Length(1, 50) issueCode?: string;
  @IsOptional() @IsDateString() issueDate?: string;
  @IsOptional() @IsIn(['CONSUMPTION', 'DAMAGE', 'DISPOSAL', 'OTHER', 'MAINTENANCE']) issueType?: string;
  @IsOptional() @IsUUID() maintenanceRecordId?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) reason?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) note?: string | null;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateStockIssueItemDto)
  items?: CreateStockIssueItemDto[];
}
