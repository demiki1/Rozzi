import { Module } from '@nestjs/common';
import { DISTANCE_SERVICE, HaversineDistanceService } from './distance.service';

@Module({
  providers: [{ provide: DISTANCE_SERVICE, useClass: HaversineDistanceService }],
  exports: [DISTANCE_SERVICE],
})
export class MapsModule {}
