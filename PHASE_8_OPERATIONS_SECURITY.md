# Rozzi Phase 8 — Operations, Finance & Admin Security

## Delivered

- Added full admin vendor population endpoint with status filtering and safe owner selection.
- Added full admin rider population endpoint with status filtering, safe owner selection, zone/location visibility, and document metadata.
- Fixed the service-area status mutation endpoint so it is protected by `OPERATIONS_ADMIN` / `SUPER_ADMIN`; it was previously missing the guard despite being an admin route.
- Expanded finance analytics to expose payment fees, net contribution, pending vendor settlements, and pending rider payouts alongside GMV, platform revenue, delivery revenue and refunds.
- Updated the Finance admin UI to display the expanded financial metrics.
- Updated Vendor and Rider admin screens to filter across the entire operational population rather than only showing approval queues.

## Security / scope notes

- Vendor and rider admin responses use explicit safe selects and do not return password hashes or bank account numbers.
- Settlement endpoints continue to record payouts in the append-only ledger; they do not execute bank transfers.
- Payment-fee ledger entries are supported by the ledger/analytics layer but are only non-zero when a payment provider integration records them.
- This phase is implemented but requires dependency installation, Prisma migration, build, unit tests and E2E execution before being marked verified.
