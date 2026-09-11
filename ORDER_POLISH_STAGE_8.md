# ROZZI Stage 8 — Customer, Vendor & Rider Operational Polish

Preserved the existing dashboards and backend architecture. This stage focuses on operational reliability and edge-case UX rather than redesign.

## Changes
- Customer order list now refreshes on realtime order-status events.
- Vendor delivery operations now refresh on realtime order-status events, with existing polling retained as fallback.
- Rider delivery offers now react to live in-app delivery-offer notifications, with polling retained as fallback.
- Rider home offer queue uses the same live offer signal.
- Backend emits a dedicated `delivery.offer_created` event whenever a new rider offer is persisted.
- NotificationsService turns that event into a safe in-app DELIVERY notification for the targeted rider.
- Rider offer notifications contain no customer OTP, payment details, or unnecessary private customer data.
- All customer/vendor/rider REST clients now attempt a single access-token refresh on HTTP 401 using the existing refresh-token endpoint, then retry the original request once. Concurrent 401s share one refresh request.
- Existing order-state validation, rider ownership checks, atomic rider claiming, delivery OTP protection, and polling fallbacks remain unchanged.

## Intentional non-changes
- No dashboard redesign.
- No replacement of the existing order state machine.
- No new delivery database model.
- No direct dashboard-to-dashboard API calls.
