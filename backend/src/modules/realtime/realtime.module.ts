import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TrackingGateway } from './tracking.gateway';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [JwtModule.register({}), OrdersModule],
  providers: [TrackingGateway],
})
export class RealtimeModule {}
