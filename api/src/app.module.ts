import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './db/database.module';
import { HealthController } from './health.controller';
import { AssetsModule } from './modules/assets/assets.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { AuthModule } from './modules/auth/auth.module';
import { WarehousesModule } from './modules/warehouses/warehouses.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';

@Module({
  imports: [
    DatabaseModule,
    CatalogModule,
    AssetsModule,
    MaterialsModule,
    AuthModule,
    WarehousesModule,
    InventoryModule,
    MaintenanceModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
