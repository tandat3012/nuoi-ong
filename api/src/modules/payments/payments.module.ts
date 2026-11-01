import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { PaymentWebhooksController } from './payment-webhooks.controller';
import { PaymentsService } from './payments.service';
import { StorePaymentsController } from './store-payments.controller';

@Module({
  imports: [AuthModule, WarehousesModule],
  controllers: [PaymentWebhooksController, StorePaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
