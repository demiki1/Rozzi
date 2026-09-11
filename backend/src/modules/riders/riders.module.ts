import { Module } from '@nestjs/common';
import { RidersService } from './riders.service';
import { RidersController } from './riders.controller';
import { RiderFinanceService } from './rider-finance.service';
import { RiderPerformanceService } from './rider-performance.service';
import { RiderOperationsService } from './rider-operations.service';
import { FinanceModule } from '../finance/finance.module';
import { MapsModule } from '../maps/maps.module';
import { PricingModule } from '../pricing/pricing.module';
import { RiderServicesService } from './rider-services.service';
import { RiderAdvancedService } from './rider-advanced.service';

@Module({
  imports: [
    FinanceModule,
    MapsModule,
    PricingModule,
  ],
  providers: [
    RidersService,
    RiderFinanceService,
    RiderPerformanceService,
    RiderOperationsService,
    RiderServicesService,
    RiderAdvancedService,
  ],
  controllers: [RidersController],
  exports: [
    RidersService,
    RiderFinanceService,
    RiderPerformanceService,
    RiderOperationsService,
    RiderServicesService,
    RiderAdvancedService,
  ],
})
export class RidersModule {}