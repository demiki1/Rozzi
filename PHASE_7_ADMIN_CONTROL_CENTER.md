# Rozzi Phase 7 — Admin Control Center

## Implemented

- Added a dedicated admin Settings module/API.
- Critical platform settings are restricted to `SUPER_ADMIN` and audit logged.
- Settings include marketplace identity, currency, default fees, minimum order, default commission rate, registration toggles, and dispatch timeout/distance/attempt controls.
- Dispatch settings are stored under the existing keys consumed by `DispatchService`, so changing them affects future dispatch decisions without code changes.
- Expanded the admin dashboard navigation with Settings, Promotions, CMS, Support, and Audit Logs.
- Added first-pass admin screens for settings, CMS content blocks, promotions, support tickets, and audit history.
- Added service-area editing and strengthened the activation checklist: an area must have an active delivery zone, an approved vendor assigned, and at least one active category before activation.
- Service-area changes and settings changes are audit logged.

## Verification

The source changes were inspected for consistency, but the project was **not runtime-verified** in this checkpoint because dependency installation was not available in the execution environment. Do not treat this checkpoint as a green build until `npm install`, Prisma generation/migrations, unit tests, E2E tests, and all application builds are run successfully.

## Blueprint alignment

This phase addresses the admin configuration, location/service-area, dispatch configuration, admin roles, and audit requirements. The 108 blueprint requires admin-controlled locations, service areas, delivery zones, fees, operating hours, vendor/rider assignment, and granular admin roles, while keeping FUTO as only the first location.
