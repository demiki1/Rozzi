import { Module } from '@nestjs/common';

import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';

import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}