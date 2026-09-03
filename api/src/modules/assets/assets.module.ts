import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { WarehousesModule } from '../warehouses/warehouses.module';

@Module({
  imports: [WarehousesModule],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
