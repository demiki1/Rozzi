# ROZZI Rider Dashboard — Phase 5 Rider Services

## Implemented

Phase 5 follows the ROZZI Rider roadmap:
- Support
- SOS / Emergency
- Insurance
- Vehicle management
- Documents / verification
- Equipment
- Rider Academy

## Backend

Added `RiderServicesService` and rider-scoped API endpoints for:
- service overview
- insurance records
- vehicle maintenance records
- equipment requests/replacements
- academy progress
- persisted SOS events/history

Added Prisma models/enums for:
- `RiderInsurance`
- `RiderVehicleMaintenance`
- `RiderEquipment`
- `RiderAcademyProgress`
- `RiderSosEvent`

Extended rider documents with optional expiry date.

All rider-facing service endpoints are protected by the existing RIDER role guard. Mutating service actions are audit logged.

## Frontend

Added:
- `/services`
- `/services/insurance`
- `/services/vehicle`
- `/services/equipment`
- `/services/academy`

Extended the emergency flow to persist an SOS event and capture browser GPS when permission is available, while retaining the support issue record.

Extended rider profile vehicle management to allow editing vehicle type.

## Verification status

Source structure and basic syntax/brace checks were performed.

A full TypeScript build could not be truthfully marked as passed in this environment because the complete project dependency/type-definition set is not installed. Prisma migration execution and live API/browser verification therefore remain pending until dependencies/database are available.

External insurance validation, equipment fulfillment, emergency response integrations, file storage, and academy content/assessment delivery are also not claimed as production integrations yet.
