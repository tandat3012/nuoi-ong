import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccountProvisioningService } from './account-provisioning.service';
import { PersonnelController } from './personnel.controller';
import { PersonnelService } from './personnel.service';

@Module({
  imports: [AuthModule],
  controllers: [PersonnelController],
  providers: [PersonnelService, AccountProvisioningService],
})
export class PersonnelModule {}
