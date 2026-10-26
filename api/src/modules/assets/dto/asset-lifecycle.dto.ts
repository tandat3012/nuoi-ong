import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const MONEY = /^(0|[1-9]\d{0,15})(\.\d{1,2})?$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const INCIDENT_TYPES = ['DAMAGE', 'LOSS', 'OTHER'] as const;
const INCIDENT_UPDATE_STATUSES = [
  'IN_PROGRESS',
  'RESOLVED',
  'CANCELLED',
] as const;

export class CreateAssetDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  itemId!: string;
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  warehouseId!: string;
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @Length(1, 100)
  @Matches(/\S/)
  assetCode!: string;
  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  serialNumber?: string | null;
  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsString()
  @Matches(DATE_ONLY)
  @IsDateString()
  purchaseDate?: string | null;
  @ApiPropertyOptional({ pattern: MONEY.source, nullable: true })
  @IsOptional()
  @IsString()
  @Matches(MONEY)
  purchasePrice?: string | null;
  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsString()
  @Matches(DATE_ONLY)
  @IsDateString()
  warrantyExpiryDate?: string | null;
  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsString()
  @Matches(DATE_ONLY)
  @IsDateString()
  nextMaintenanceDate?: string | null;
  @ApiPropertyOptional({ maxLength: 4000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string | null;
}

export class UpdateAssetDto {
  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  updatedAt!: string;
  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  serialNumber?: string | null;
  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsString()
  @Matches(DATE_ONLY)
  @IsDateString()
  purchaseDate?: string | null;
  @ApiPropertyOptional({ pattern: MONEY.source, nullable: true })
  @IsOptional()
  @IsString()
  @Matches(MONEY)
  purchasePrice?: string | null;
  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsString()
  @Matches(DATE_ONLY)
  @IsDateString()
  warrantyExpiryDate?: string | null;
  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsString()
  @Matches(DATE_ONLY)
  @IsDateString()
  nextMaintenanceDate?: string | null;
  @ApiPropertyOptional({ maxLength: 4000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string | null;
}

export class AssignAssetDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  assignedToMemberId!: string;
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  expectedReturnAt?: string | null;
  @ApiPropertyOptional({ maxLength: 4000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string | null;
}

export class EmptyAssetActionDto {}

export class RetireAssetDto {
  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @Length(1, 4000)
  @Matches(/\S/)
  note!: string;
}

export class ReportAssetIncidentDto {
  @ApiProperty({ enum: INCIDENT_TYPES })
  @IsIn(INCIDENT_TYPES)
  incidentType!: (typeof INCIDENT_TYPES)[number];
  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @Length(1, 4000)
  @Matches(/\S/)
  description!: string;
  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity!: string;
}

export class UpdateAssetIncidentStatusDto {
  @ApiProperty({ enum: INCIDENT_UPDATE_STATUSES })
  @IsIn(INCIDENT_UPDATE_STATUSES)
  status!: (typeof INCIDENT_UPDATE_STATUSES)[number];
}

export class RecoverAssetDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  warehouseId!: string;
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;
  @ApiPropertyOptional({ maxLength: 4000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string | null;
}

export class TransferAssetDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  warehouseId!: string;
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;
  @ApiPropertyOptional({ maxLength: 4000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string | null;
}
