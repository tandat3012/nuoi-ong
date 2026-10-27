import { Module } from '@nestjs/common';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationDevicesController } from './notification-devices.controller';
import { NotificationDevicesService } from './notification-devices.service';
import { ExpoPushClient } from './expo-push.client';
import { PushOutboxRepository } from './push-outbox.repository';
import { NotificationPushWorker } from './notification-push.worker';
import { PUSH_WORKER_OPTIONS, pushWorkerOptions } from './push-worker.options';

@Module({
  imports: [WarehousesModule],
  controllers: [NotificationsController, NotificationDevicesController],
  providers: [
    NotificationsService,
    NotificationDevicesService,
    ExpoPushClient,
    PushOutboxRepository,
    NotificationPushWorker,
    { provide: PUSH_WORKER_OPTIONS, useFactory: () => pushWorkerOptions() },
  ],
})
export class NotificationsModule {}
