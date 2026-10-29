import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

const REQUEST_TYPES = ['CORRECTIVE', 'INSPECTION'] as const;

export class CreateMaintenanceRequestDto {
  @IsUUID() assetId!: string;
  @ApiProperty({ enum: REQUEST_TYPES })
  @IsIn(REQUEST_TYPES)
  maintenanceType!: (typeof REQUEST_TYPES)[number];
  @ApiProperty({ minLength: 3, maxLength: 4000 })
  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  description!: string;
}

export class ApproveMaintenanceRequestDto {
  @ApiProperty({ format: 'date-time', example: '2026-11-02T09:00:00.000Z' })
  @IsDateString()
  scheduledAt!: string;
}

export class RejectMaintenanceRequestDto {
  @ApiProperty({ minLength: 3, maxLength: 1000 })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  rejectionReason!: string;
}
