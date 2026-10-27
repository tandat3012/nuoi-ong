import { Module } from '@nestjs/common';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceRequestsController } from './maintenance-requests.controller';
import { MaintenanceRequestsService } from './maintenance-requests.service';

@Module({ imports: [WarehousesModule], controllers: [MaintenanceController, MaintenanceRequestsController], providers: [MaintenanceService, MaintenanceRequestsService] })
export class MaintenanceModule {}
