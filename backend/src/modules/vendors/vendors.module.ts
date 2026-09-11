import { Module } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';
import { VendorsController } from './vendors.controller';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { VendorOnboardingService } from './vendor-onboarding.service';
import { VendorAdvancedService } from '../vendor-advanced/vendor-advanced.service';
import { VendorAdvancedController } from '../vendor-advanced/vendor-advanced.controller';
import { VendorOnboardingController } from './vendor-onboarding.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [AuditModule, NotificationsModule, StorageModule],
  providers: [VendorsService, TeamService, VendorOnboardingService, VendorAdvancedService],
  controllers: [VendorsController, TeamController, VendorOnboardingController, VendorAdvancedController],
  exports: [VendorsService, TeamService, VendorOnboardingService, VendorAdvancedService],
})
export class VendorsModule {}
