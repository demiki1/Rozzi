# ROZZI Rider Dashboard — Phase 4 Operations

## Scope
Phase 4 follows the agreed Rider roadmap:
29. Live map
30. Heatmap
31. Delivery zones
32. Scheduling
33. Auto-assignment
34. Batched deliveries
35. Smart dispatch

## Implemented
- Existing live rider map/location foundation retained.
- Rider operations overview endpoint.
- Demand heatmap derived from recent active delivery demand in the rider's assigned service areas.
- Rider delivery-zone visibility using assigned ServiceArea records.
- Rider scheduling/session model with booked, checked-in, completed, cancelled and missed states.
- Shift booking with overlap prevention and zone validation.
- Shift cancellation and controlled check-in (opens 15 minutes before start).
- Operations dashboard and dedicated Schedule screen with responsive rider UX.
- Existing automatic dispatch retained and upgraded from nearest-rider ranking to weighted smart dispatch using distance, current workload and rider rating while respecting a two-delivery active capacity.
- Batched delivery suggestions for compatible nearby deliveries in the rider's current service area.
- Atomic batch acceptance with a two-delivery cap and DeliveryGroup creation/reuse.
- Audit records for shift booking and batch acceptance.

## Important implementation boundaries
- Heatmap is an operational demand visualization, not a predictive demand forecast.
- The map still uses the project's existing distance abstraction; no external maps/routing provider credentials are assumed.
- Scheduling is rider self-booking for now; admin-side workforce scheduling remains a future operations/admin capability.
- Batch matching currently uses proximity/service-area rules rather than traffic-aware route optimization.
- Smart dispatch is rule-based, deliberately avoiding an over-engineered AI/optimization system at this stage.

## Verification status
Static source structure and brace/syntax-shape checks were performed. Full dependency-backed TypeScript compilation, Prisma generation/migration execution, Next.js build and end-to-end runtime tests were not available in this sandbox because the complete project dependencies/CLI tooling are not installed.

Therefore this package is **source-level Phase 4 implementation**, not a claim of full runtime verification.
