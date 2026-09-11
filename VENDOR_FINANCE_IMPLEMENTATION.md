# ROZZI Vendor Finance — Step 16

## Implemented
- Vendor finance overview API and dashboard.
- Available balance derived from the append-only vendor ledger.
- Pending balance derived from vendor orders that are still operationally in progress.
- Delivered-order earnings breakdown with commission snapshots.
- Vendor ledger transaction history.
- Vendor payout history.
- Vendor payment-account record with masked account number (last four digits only).
- Payment-account update flow with audit logging.
- Vendor payout records created when an admin records a settlement.
- Payout bank/account snapshot retained for settlement history.
- Refund ledger compensation now reverses the vendor/platform/rider economic allocation proportionally for processed refunds.
- Finance is mobile responsive and integrated into the VendorShell.

## API
- `GET /api/vendor/finance/overview`
- `GET /api/vendor/finance/earnings`
- `GET /api/vendor/finance/transactions`
- `GET /api/vendor/finance/payouts`
- `GET /api/vendor/finance/payment-account`
- `POST /api/vendor/finance/payment-account`

## Security / financial integrity
- Vendor endpoints are protected by the vendor role guard.
- Vendor data is scoped through the authenticated vendor owner.
- Raw bank account numbers are not persisted in the new vendor payment-account table.
- Ledger entries remain append-only; balances are derived from ledger sums.
- Payment-account changes are audit logged.
- Refund allocation is idempotent per refund component.

## Provider limitation
Actual bank transfer execution is not claimed as complete. The existing project has provider adapters for customer payment/refund flows, but no configured vendor-bank transfer execution provider. The settlement record therefore represents an administrative settlement record, not a simulated bank transfer.

## Verification status
Static targeted checks passed. Full Prisma generation/migration and NestJS/Next production builds could not be executed in this environment because project dependencies are not installed and package installation timed out. Run locally:

```text
cd backend
npm install
npm run prisma:generate
npm run prisma:deploy
npm run build
npm test

cd ../apps/vendor
npm install
npm run build
```

Finance should remain the active Vendor Dashboard module until those local checks pass.
