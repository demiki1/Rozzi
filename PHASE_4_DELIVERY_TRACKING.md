# Phase 4 — Delivery Models, Service-Area Enforcement & Live Tracking

Implemented:
- Explicit order delivery model snapshot (`PLATFORM_DELIVERY`, `SELF_DELIVERY`, `CUSTOMER_PICKUP`).
- Checkout validates the selected model against vendor-supported models.
- Pickup automatically uses `CUSTOMER_PICKUP`.
- Vendor self-delivery remains a DELIVERY order but bypasses platform rider dispatch and can be completed by the vendor.
- Delivery fee now supports service-area base fee + per-km fee when coordinates are available.
- Delivery-zone max distance is enforced when coordinates are available.
- Rider cannot go offline while holding an active delivery.
- Rider location updates emit a realtime event.
- Realtime gateway broadcasts GPS only into authorized order rooms, never as a global rider feed.

Not yet verified:
- TypeScript compilation
- Prisma migration against a live database
- Socket.IO end-to-end GPS flow
- Road-distance/ETA provider (current distance service is Haversine fallback)
- Polygon/geofence calculations
