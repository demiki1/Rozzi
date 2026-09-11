import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { AddressesService } from './addresses.service';
import { OrderStateMachine } from './order-state-machine';
import { ProductsModule } from '../products/products.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { SettingsModule } from '../settings/settings.module';
import { FinanceModule } from '../finance/finance.module';
import { PricingModule } from '../pricing/pricing.module';
import { MapsModule } from '../maps/maps.module';
import { AuditModule } from '../audit/audit.module';
import { CommissionModule } from '../commission/commission.module';

@Module({
  imports: [ProductsModule, PromotionsModule, MapsModule, AuditModule, SettingsModule, FinanceModule, PricingModule, CommissionModule],
  providers: [OrdersService, AddressesService, OrderStateMachine],
  controllers: [OrdersController],
  exports: [OrdersService, OrderStateMachine],
})
export class OrdersModule {}
