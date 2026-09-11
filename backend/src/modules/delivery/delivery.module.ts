import { Module } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { DeliveryController } from './delivery.controller';
import { OrdersModule } from '../orders/orders.module';
import { MapsModule } from '../maps/maps.module';

// One-directional dependency only: DeliveryModule depends on OrdersModule
// (for OrdersService), never the other way around. This is what keeps
// dispatch-start a manual/explicit call for now instead of an automatic
// reaction to "vendor marked ready" — see the note in DispatchService.
@Module({
  imports: [OrdersModule, MapsModule],
  providers: [DispatchService],
  controllers: [DeliveryController],
  exports: [DispatchService],
})
export class DeliveryModule {}
