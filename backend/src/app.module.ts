import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './config/prisma.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { LocationsModule } from './modules/locations/locations.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { VendorCategoriesModule } from './modules/vendor-categories/vendor-categories.module';
import { ProductOptionsModule } from './modules/products/product-options.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { OutletsModule } from './modules/outlets/outlets.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { CartModule } from './modules/cart/cart.module';
import { AccountModule } from './modules/account/account.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { RidersModule } from './modules/riders/riders.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { FinanceModule } from './modules/finance/finance.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { CmsModule } from './modules/cms/cms.module';
import { SupportModule } from './modules/support/support.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SettingsModule } from './modules/settings/settings.module';
import { HealthModule } from './modules/health/health.module';
import { StorageModule } from './modules/storage/storage.module';
import { AdvertisingModule } from './modules/advertising/advertising.module';
import { VendorAdvertisingModule } from './modules/vendor-advertising/vendor-advertising.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { PricingModule } from './modules/pricing/pricing.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]), // global default rate limit
    // Global event bus (decouples Orders/Delivery/Notifications/Finance/
    // Realtime so none of them import each other directly).
    EventEmitterModule.forRoot(),
    // Enables @Cron() handlers anywhere in the app — first real use is
    // DispatchService's delivery-offer timeout sweep (closes the Phase 7
    // "no scheduler" gap).
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    AuthModule,
    LocationsModule,
    CategoriesModule,
    VendorCategoriesModule,
    ProductOptionsModule,
    VendorsModule,
    OutletsModule,
    ProductsModule,
    InventoryModule,
    CartModule,
    AccountModule,
    FavoritesModule,
    WalletModule,
    OrdersModule,
    PaymentsModule,
    RidersModule,
    DeliveryModule,
    NotificationsModule,
    RealtimeModule,
    FinanceModule,
    ReviewsModule,
    SettingsModule,
    HealthModule,
    StorageModule,
    AdvertisingModule,
    VendorAdvertisingModule,
    PromotionsModule,
    ReferralsModule,
    PricingModule,
    SupportModule,
    CmsModule,
  ],
  providers: [
    // Every route requires a valid JWT by default; use @Public() to opt out.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}

