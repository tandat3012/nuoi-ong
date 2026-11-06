import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommerceModule } from '../commerce/commerce.module';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { CustomerOrdersController } from './customer-orders.controller';
import { StoreOrdersController } from './store-orders.controller';
import { StoreOrdersService } from './store-orders.service';
import { StoreWarrantiesController } from './store-warranties.controller';
import { StoreWarrantiesService } from './store-warranties.service';

@Module({
  imports: [AuthModule, CommerceModule, WarehousesModule],
  controllers: [
    CustomerOrdersController,
    StoreOrdersController,
    StoreWarrantiesController,
  ],
  providers: [StoreOrdersService, StoreWarrantiesService],
})
export class StoreOrdersModule {}
