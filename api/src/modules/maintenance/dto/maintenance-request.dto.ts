import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateMaintenanceRequestDto {
  @IsUUID() assetId!: string;
  @IsIn(['CORRECTIVE', 'INSPECTION']) maintenanceType!: 'CORRECTIVE' | 'INSPECTION';
  @IsString() @MinLength(3) @MaxLength(4000) description!: string;
}

export class ApproveMaintenanceRequestDto {
  @ApiProperty({ format: 'date-time', example: '2026-11-02T09:00:00.000Z' })
  @IsDateString() scheduledAt!: string;
}

export class RejectMaintenanceRequestDto {
  @IsString() @MinLength(3) @MaxLength(1000) rejectionReason!: string;
}
