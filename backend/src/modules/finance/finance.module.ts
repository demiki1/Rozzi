import { Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { AnalyticsService } from './analytics.service';
import { FinanceController } from './finance.controller';
import { VendorFinanceController } from './vendor-finance.controller';
import { VendorFinanceService } from './vendor-finance.service';

// Deliberately imports neither OrdersModule, PaymentsModule, nor
// DeliveryModule — LedgerService only listens to their events
// (PAYMENT_SUCCEEDED_EVENT, ORDER_TRANSITIONED_EVENT). Same decoupling
// payoff as NotificationsModule in Phase 9.
@Module({
  providers: [LedgerService, AnalyticsService, VendorFinanceService],
  controllers: [FinanceController, VendorFinanceController],
  exports: [LedgerService, AnalyticsService, VendorFinanceService],
})
export class FinanceModule {}
