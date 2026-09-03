import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

const COST = /^(0|[1-9]\d{0,15})(\.\d{1,2})?$/;
const TYPES = ['PREVENTIVE', 'CORRECTIVE', 'INSPECTION'] as const;

export class CreateMaintenanceRecordDto {
  @IsUUID() assetId!: string;
  @IsIn(TYPES) maintenanceType!: (typeof TYPES)[number];
  @IsOptional() @IsUUID() incidentId?: string | null;
  @IsOptional() @IsDateString() scheduledAt?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) description?: string | null;
  @IsOptional() @IsUUID() performedByMemberId?: string | null;
  @IsOptional() @IsUUID() supplierId?: string | null;
  @IsOptional() @Matches(COST) laborCost?: string;
  @IsOptional() @Matches(COST) materialCost?: string;
  @IsOptional() @Matches(COST) otherCost?: string;
}

export class UpdateMaintenanceRecordDto {
  @IsOptional() @IsIn(TYPES) maintenanceType?: string;
  @IsOptional() @IsDateString() scheduledAt?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) description?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) resultNote?: string | null;
  @IsOptional() @IsUUID() performedByMemberId?: string | null;
  @IsOptional() @IsUUID() supplierId?: string | null;
  @IsOptional() @Matches(COST) laborCost?: string;
  @IsOptional() @Matches(COST) materialCost?: string;
  @IsOptional() @Matches(COST) otherCost?: string;
}
