import { Injectable } from '@nestjs/common';

// §17: "Do not hard-code one [maps] provider... Create a maps service
// abstraction." DispatchService depends on this interface, not on any
// specific implementation. Right now the only implementation is a
// straight-line (Haversine) calculator — no geocoding/routing/ETA provider
// is wired up yet. That's honest: a real provider (Google/Mapbox/etc) would
// give road-distance and ETA, which straight-line distance does not. Swap
// `HaversineDistanceService` for a real provider-backed implementation
// behind this same interface when MAPS_API_KEY is actually configured.
export interface DistanceService {
  distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number;
}

export const DISTANCE_SERVICE = 'DISTANCE_SERVICE';

@Injectable()
export class HaversineDistanceService implements DistanceService {
  distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }
}
