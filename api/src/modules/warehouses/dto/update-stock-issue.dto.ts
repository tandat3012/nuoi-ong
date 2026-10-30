import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  IsUUID,
  Length,
  MaxLength,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { CreateStockIssueItemDto } from './create-stock-issue.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStockIssueDto {
  @IsOptional() @IsUUID() warehouseId?: string;
  // null must fail: a draft keeps its code until confirmation assigns one.
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Length(1, 50)
  @Matches(/\S/)
  issueCode?: string;
  @ApiPropertyOptional({ format: 'date', example: '2026-10-08' })
  @IsOptional()
  @IsDateString()
  issueDate?: string;
  @IsOptional()
  @IsIn(['SALE', 'CONSUMPTION', 'DAMAGE', 'DISPOSAL', 'OTHER', 'MAINTENANCE'])
  issueType?: string;
  @IsOptional() @IsUUID() maintenanceRecordId?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) reason?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) note?: string | null;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStockIssueItemDto)
  items?: CreateStockIssueItemDto[];
}
