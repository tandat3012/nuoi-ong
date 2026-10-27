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
import { CommerceModule } from './modules/commerce/commerce.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { PersonnelModule } from './modules/personnel/personnel.module';
import { StoreAdminModule } from './modules/store-admin/store-admin.module';
import { StoreOrdersModule } from './modules/store-orders/store-orders.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

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
    CommerceModule,
    CloudinaryModule,
    PersonnelModule,
    StoreAdminModule,
    StoreOrdersModule,
    DashboardModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
