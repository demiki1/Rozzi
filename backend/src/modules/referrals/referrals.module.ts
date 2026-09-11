import { Module } from '@nestjs/common';

import { ReferralsController } from './referrals.controller';
import { ReferralsAdminController } from './referrals-admin.controller';

import { ReferralsService } from './referrals.service';
import { ReferralsAdminService } from './referrals-admin.service';

import { ReferralsOrderListener } from './referrals-order.listener';
import { ReferralCreditsService } from './referral-credits.service';

import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    AuditModule,
  ],
  controllers: [
    ReferralsController,
    ReferralsAdminController,
  ],
  providers: [
    ReferralsService,
    ReferralsAdminService,
    ReferralsOrderListener,
    ReferralCreditsService,
  ],
  exports: [
    ReferralsService,
    ReferralCreditsService,
  ],
})
export class ReferralsModule {}
