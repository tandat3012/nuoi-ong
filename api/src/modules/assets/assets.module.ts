import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { AssetLifecycleService } from './asset-lifecycle.service';
import { AssetHistoryService } from './asset-history.service';
import { AssetTransferRequestsController } from './asset-transfer-requests.controller';
import { AssetTransferRequestsService } from './asset-transfer-requests.service';

@Module({
  imports: [WarehousesModule],
  controllers: [AssetsController, AssetTransferRequestsController],
  providers: [
    AssetsService,
    AssetLifecycleService,
    AssetHistoryService,
    AssetTransferRequestsService,
  ],
  exports: [AssetsService, AssetLifecycleService, AssetHistoryService],
})
export class AssetsModule {}
