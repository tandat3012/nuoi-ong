import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { AssetLifecycleService } from './asset-lifecycle.service';
import { AssetHistoryService } from './asset-history.service';

@Module({
  imports: [WarehousesModule],
  controllers: [AssetsController],
  providers: [AssetsService, AssetLifecycleService, AssetHistoryService],
  exports: [AssetsService, AssetLifecycleService, AssetHistoryService],
})
export class AssetsModule {}
