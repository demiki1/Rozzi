# Testing

## What exists

**Unit tests** (`test/unit/`, no database needed):
- `order-state-machine.spec.ts` — every transition rule in §14, including
  the pickup-order shortcut, terminal-state rejection, and illegal-skip
  rejection.
- `ledger-commission.spec.ts` — the §21 commission math (vendor earning =
  subtotal minus commission, computed on subtotal only, never on delivery/
  service fees), the pickup-order-has-no-rider-earning case, and the
  idempotent-rebooking guard.
- `admin-roles.guard.spec.ts` — §38 sub-role enforcement, including the
  SUPER_ADMIN-always-passes rule and the no-adminRole-assigned rejection.
- `cart-single-vendor.spec.ts` — §42's one-vendor-per-cart rule, including
  the exact error code (`CART_VENDOR_MISMATCH`) the frontend depends on.

**End-to-end test** (`test/e2e/order-lifecycle.e2e-spec.ts`): implements
§51's named critical scenario verbatim — register three accounts, vendor
lists a product, customer orders, pays via the dev stub, vendor fulfills,
dispatch auto-starts, rider accepts and delivers with OTP confirmation,
and the ledger books vendor/rider/commission entries. Runs against a real
HTTP server (via supertest) and a real Postgres database — it is not
mocked, on purpose, since this is meant to catch integration problems
unit tests can't see.

## What does NOT exist yet

Despite §51 asking for a broad suite (auth tests, payment webhook tests,
permission tests beyond AdminRolesGuard, delivery-assignment-specific
tests), this pass covers the highest-risk / most-load-bearing logic rather
than every module. Not covered: `JwtAuthGuard`/`RolesGuard` in isolation,
Paystack webhook signature verification, the dispatch offer/decline/
timeout chain in isolation (only exercised indirectly via the e2e happy
path), vendor/rider approval workflow tests, and category/location CRUD
tests. Treat this as a solid foundation and a pattern to extend, not
complete coverage.

## Running the tests

```bash
cd backend
npm install

# Unit tests — no database required
npm test

# E2E test — REQUIRES a real Postgres database with migrations applied,
# and NODE_ENV=development (the e2e test relies on the dev-only
# payment-confirmation stub rather than live Paystack credentials — see
# the comment at the top of order-lifecycle.e2e-spec.ts for why).
export NODE_ENV=development
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/marketplace_test
npx prisma migrate deploy
npm run test:e2e
```

The e2e test creates all its own fixtures (location, service area,
category, vendor type) with a timestamp suffix, so it's safe to run
against a shared dev database — but a dedicated test database is
recommended so a failed run's leftover rows don't confuse manual testing.

## Honesty note

None of this has been executed in the environment it was written in — no
network access to install dependencies or reach a database. Every test
was checked by hand against the actual route names, DTO shapes, and
service signatures in this codebase (see the git-history-equivalent: each
was written immediately after or alongside the code it tests), but
"carefully written" and "confirmed passing" are different claims. Please
run this and report back what breaks — that feedback is genuinely wanted,
not a formality.
