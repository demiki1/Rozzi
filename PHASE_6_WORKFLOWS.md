# Rozzi Phase 6 — Connected delivery workflows

Implemented in this checkpoint:

- Customer delivery tracking REST endpoint with rider/location/status timeline.
- Customer tracking page with automatic polling.
- Customer in-app notifications page.
- Rider current-delivery endpoint and guided delivery progression UI.
- Rider current delivery action flow: arrived pickup → picked up → depart → arrived → OTP confirmation.
- Rider dashboard now supports both APPROVED and ACTIVE online states.
- Vendor delivery-model configuration endpoint/UI for platform delivery, self-delivery, and pickup.
- Vendor document upload endpoint (URL-based until storage abstraction is connected).
- Existing rider onboarding, document upload, location update, approval, zone assignment and dispatch logic retained.
- Existing Socket.IO order-room tracking and rider-location broadcasts retained.

Verification status: implemented, but not runtime-verified in this environment because project dependencies/database have not been successfully installed and executed here.

External integration status: file/document uploads currently accept hosted URLs; object storage is not yet connected. Email/SMS providers remain console adapters until real provider credentials are supplied.
