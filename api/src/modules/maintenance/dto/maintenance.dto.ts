import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  Min,
  Max,
  IsNotEmpty,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

const COST = /^(0|[1-9]\d{0,15})(\.\d{1,2})?$/;
const TYPES = ['PREVENTIVE', 'CORRECTIVE', 'INSPECTION'] as const;

export class CreateMaintenanceRecordDto {
  @IsUUID() assetId!: string;
  @IsIn(TYPES) maintenanceType!: (typeof TYPES)[number];
  @IsOptional() @IsUUID() incidentId?: string | null;
  @ApiPropertyOptional({
    format: 'date-time',
    example: '2026-10-10T09:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) description?: string | null;
  @IsOptional() @IsUUID() performedByMemberId?: string | null;
  @IsOptional() @IsUUID() supplierId?: string | null;
  @IsOptional() @IsDateString() expectedReturnAt?: string | null;
  @ApiPropertyOptional({ example: '500000.00', pattern: COST.source })
  @IsOptional()
  @Matches(COST)
  laborCost?: string;
  @ApiPropertyOptional({ example: '125000.00', pattern: COST.source })
  @IsOptional()
  @Matches(COST)
  materialCost?: string;
  @ApiPropertyOptional({ example: '0.00', pattern: COST.source })
  @IsOptional()
  @Matches(COST)
  otherCost?: string;
}

export class UpdateMaintenanceRecordDto {
  @IsOptional() @IsIn(TYPES) maintenanceType?: string;
  @ApiPropertyOptional({
    format: 'date-time',
    example: '2026-10-10T09:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) description?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) resultNote?: string | null;
  @IsOptional() @IsUUID() performedByMemberId?: string | null;
  @IsOptional() @IsUUID() supplierId?: string | null;
  @IsOptional() @IsDateString() expectedReturnAt?: string | null;
  @ApiPropertyOptional({ example: '500000.00', pattern: COST.source })
  @IsOptional()
  @Matches(COST)
  laborCost?: string;
  @ApiPropertyOptional({ example: '125000.00', pattern: COST.source })
  @IsOptional()
  @Matches(COST)
  materialCost?: string;
  @ApiPropertyOptional({ example: '0.00', pattern: COST.source })
  @IsOptional()
  @Matches(COST)
  otherCost?: string;
}

export class CompleteMaintenanceRecordDto {
  @IsIn(['PASSED', 'FAILED']) outcome!: 'PASSED' | 'FAILED';
  @IsOptional() @IsInt() @Min(1) @Max(120) intervalMonths?: number;
  @ApiPropertyOptional({ maxLength: 4000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  resultNote?: string | null;
  @ApiPropertyOptional({ example: '500000.00', pattern: COST.source })
  @IsOptional()
  @Matches(COST)
  laborCost?: string;
  @ApiPropertyOptional({ example: '125000.00', pattern: COST.source })
  @IsOptional()
  @Matches(COST)
  materialCost?: string;
  @ApiPropertyOptional({ example: '0.00', pattern: COST.source })
  @IsOptional()
  @Matches(COST)
  otherCost?: string;
}

export class ReceiveMaintenanceDto {
  @IsDateString() receivedAt!: string;
}
export class MaintenanceReturnDto {
  @IsUUID() warehouseId!: string;
  @IsUUID() locationId!: string;
}
export class RejectMaintenanceReturnDto {
  @IsString() @IsNotEmpty() @MaxLength(4000) reason!: string;
}

export class MaintenanceDecisionDto {
  @ApiPropertyOptional({ description: 'Bắt buộc khi chưa cho dùng lại.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string;
}
