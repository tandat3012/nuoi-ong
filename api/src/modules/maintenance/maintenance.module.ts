import { Module } from '@nestjs/common';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { MaintenanceRequestsController } from './maintenance-requests.controller';
import { MaintenanceRequestsService } from './maintenance-requests.service';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [WarehousesModule],
  controllers: [MaintenanceController, MaintenanceRequestsController],
  providers: [MaintenanceService, MaintenanceRequestsService],
})
export class MaintenanceModule {}
