import { Module } from '@nestjs/common';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';

@Module({ imports: [WarehousesModule], controllers: [MaintenanceController], providers: [MaintenanceService] })
export class MaintenanceModule {}
