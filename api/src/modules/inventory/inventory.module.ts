import { Module } from '@nestjs/common';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryAdjustmentsController } from './inventory-adjustments.controller';
import { InventoryAdjustmentsService } from './inventory-adjustments.service';

@Module({
  imports: [WarehousesModule],
  controllers: [InventoryController, InventoryAdjustmentsController],
  providers: [InventoryService, InventoryAdjustmentsService],
})
export class InventoryModule {}
