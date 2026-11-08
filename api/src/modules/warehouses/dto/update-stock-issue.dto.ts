import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateStockIssueItemDto } from './create-stock-issue.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentNumberingOptionsDto } from './document-numbering.dto';

export class UpdateStockIssueDto extends DocumentNumberingOptionsDto {
  @IsOptional() @IsUUID() warehouseId?: string;
  // Legacy field: ignored, the code is assigned on confirmation.
  @ApiPropertyOptional({
    deprecated: true,
    description: 'Ignored. The permanent code is assigned on confirmation.',
  })
  @IsOptional()
  issueCode?: unknown;
  @ApiPropertyOptional({ format: 'date', example: '2026-10-08' })
  @IsOptional()
  @IsDateString()
  issueDate?: string;
  @IsOptional()
  @IsIn(['SALE', 'CONSUMPTION', 'DAMAGE', 'DISPOSAL', 'OTHER', 'MAINTENANCE'])
  issueType?: string;
  @IsOptional() @IsUUID() maintenanceRecordId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  recipientMemberId?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) reason?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) note?: string | null;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStockIssueItemDto)
  items?: CreateStockIssueItemDto[];
}
