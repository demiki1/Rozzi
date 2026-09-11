# ROZZI Integration Stage 4 — Order Bridge

This stage preserves the existing dashboard designs and reconciles the runtime contracts used by the Customer, Vendor, Rider and Admin applications.

## Verified shared lifecycle

`PENDING_PAYMENT -> PAID -> PENDING_VENDOR -> ACCEPTED -> PREPARING -> READY_FOR_PICKUP -> RIDER_SEARCHING -> RIDER_ASSIGNED -> RIDER_ARRIVED_PICKUP -> PICKED_UP -> IN_TRANSIT -> RIDER_ARRIVED -> DELIVERED`

Pickup/vendor self-delivery orders can complete from `READY_FOR_PICKUP -> DELIVERED`. All order mutations continue to pass through the existing central `OrderStateMachine`.

## Corrections made

- Fixed the delivery retry authorization path so the endpoint advertised for Vendor/Admin fallback actually permits authenticated admins while still ensuring vendors can only dispatch their own orders.
- Corrected Customer cancellation controls to match backend policy: direct customer cancellation is shown only for `PENDING_PAYMENT`, `PAID`, and `PENDING_VENDOR`.
- Removed the stale/nonexistent `OUT_FOR_DELIVERY` customer status and aligned the UI with the real rider state machine.
- Added safe 5-second refresh to the customer order detail, vendor order queue, admin order list and admin order detail, so status propagation is visible across dashboards without manual refresh.
- Completed the Admin status filter list with `RIDER_SEARCHING`, `RIDER_ARRIVED_PICKUP`, and `RIDER_ARRIVED`.
- Added existing delivery/rider assignment information to the Admin order detail without changing the Admin dashboard architecture.

## Existing bridge functionality preserved

- Payment confirmation advances an immediate order to `PENDING_VENDOR`; scheduled paid orders are released by the existing scheduler.
- Vendor accepts, prepares and marks ready using existing backend endpoints.
- `READY_FOR_PICKUP` automatically triggers rider dispatch for platform delivery orders through the existing order-transition event listener.
- Rider offer claiming remains atomic so two riders cannot claim the same delivery.
- Rider pickup generates a customer-only four-digit delivery code; the rider cannot read it from rider-facing APIs.
- Delivery cannot become `DELIVERED` until the rider confirms that customer-supplied code.
- Customer tracking, notifications, order timeline, vendor notifications, admin oversight, finance ledger events, and WebSocket status broadcasts remain attached to the same order-transition event.

## Verification note

Static TypeScript/source checks are run in this workspace. Full runtime/database E2E verification still requires installing the workspace dependencies and running PostgreSQL/migrations in the user's normal ROZZI development environment.
