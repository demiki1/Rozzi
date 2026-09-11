# ROZZI Vendor Dashboard — Advanced/Bulk Phase

Implemented blueprint features:
- Scheduled product availability windows (recurring daily time + weekday selection fields)
- Scheduled menus with recurring time windows and product membership
- Optional maximum orders per hour setting
- Bulk product availability changes
- Bulk category assignment endpoint
- Bulk price/discount/general product updates endpoint
- Bulk stock set/update endpoint
- Catalogue CSV export
- Catalogue CSV import with row-level validation/errors and SKU-based update behavior
- Vendor ownership checks and audit logging on bulk mutations
- Vendor UI for capacity, selection, scheduled menus, bulk availability, and CSV export

Important integration boundary:
- `maxOrdersPerHour` is stored and managed, but the order-creation path still needs to enforce this capacity atomically before it can be called an end-to-end production feature.
- CSV import/export is implemented without a third-party parser; production-scale CSV ingestion should be load-tested.
- POS integration, inventory synchronization, order synchronization, and third-party delivery integration remain future integrations as specified by the blueprint.
