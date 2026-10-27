import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../../cloudinary/cloudinary.module';
import { AuthModule } from '../auth/auth.module';
import { StoreAdminController } from './store-admin.controller';
import { StoreAdminService } from './store-admin.service';

@Module({
  imports: [AuthModule, CloudinaryModule],
  controllers: [StoreAdminController],
  providers: [StoreAdminService],
})
export class StoreAdminModule {}
