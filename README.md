# Nigerian Multi-Category Marketplace + Local Delivery Platform

## Status: Phase 12 of 12 — all numbered phases complete (Phase 3 partially covered — see note below)

All 12 phases from the original spec now have something built. This is
**not** the same as "done" or "production-ready" — see
`PRODUCTION_CHECKLIST.md` for an honest, item-by-item accounting, and the
"Open design flags" and "What is NOT implemented" sections below for
everything still outstanding. Most notably: **the customer, vendor, and
rider frontends don't exist** — only the admin dashboard has a UI. That
was never one of the 12 numbered phases in the original plan, but it's
obviously required before this is usable by an actual customer, vendor, or
rider. Next steps, as agreed, are revisiting the accumulated open items —
starting with that.

**Note on Phase 3:** as before — vendor profile/product management exists
as backend API; the sales/settlement view needs the ledger (Phase 10), and
there is still no vendor or rider dashboard *UI* (only admin, as of this
phase).

## What's implemented and runnable right now

**Backend (Phases 1–7):** JWT auth, role guards, location tree, categories,
vendor registration/approval, products/inventory, single-vendor cart,
transactional checkout with a full order state machine, Paystack payments
with idempotent verified webhooks, rider registration/verification/
location, and nearest-rider delivery dispatch with OTP confirmation. (This
summary is condensed — the per-phase detail that used to live in this
README, e.g. exactly which race conditions are handled and where, is in
this conversation's history rather than duplicated here; ask if you want
any of it restated.)

**Phase 8 — Admin Dashboard (frontend, `apps/admin`):**
- Next.js (App Router) + Tailwind, talking to the backend via a small fetch
  wrapper that unwraps the backend's `{ success, error }` shape and
  retries once through `/api/auth/refresh` on a 401.
- **Overview**: live counts (in-progress orders, pending vendor/rider
  approvals, active service areas) — explicitly *not* the full analytics
  dashboard from §60/§61, which needs the ledger (Phase 10).
- **Orders**: list with status filter, detail page with item breakdown,
  fee breakdown, and status timeline.
- **Vendors** / **Riders**: approval queues with approve/reject/(start
  review)/suspend actions, matching the workflows built in Phases 3 and 6.
- **Locations**: the location tree, service area creation/activation, and
  delivery zone creation — the actual UI for §94's "click ACTIVATE
  LOCATION" flow (though the launch-checklist validation itself is still
  just "has at least one delivery zone," as built in Phase 1).
- **Categories**: simple enable/disable/create CRUD (§25).
- **Gaps flagged, not hidden** (see `apps/admin/README.md` for the full
  list): no UI yet for settlements/payouts/reports (blocked on ledger),
  promotions, homepage CMS, notifications, support, reviews, or audit logs
  — and two gaps worth calling out here specifically because they're easy
  to assume are handled when they aren't:
  - **`AuditLog` (§39) has existed since Phase 1 but nothing anywhere in
    the codebase writes to it.** No admin action across any phase
    currently creates an audit log entry. This needs to be retrofitted
    onto every sensitive admin action (approve/reject/suspend/status
    change/etc.), not just added going forward.
  - **`AdminRole` sub-roles (§38) exist on the schema but aren't
    enforced.** Every admin endpoint checks only `@Roles(UserRole.ADMIN)`
    — a `SUPPORT_ADMIN` currently has the same access as a `SUPER_ADMIN`.
    The granular permission split the spec asks for isn't real yet.

**Phase 9 — Notifications, Real-Time Tracking, and a Real Scheduler:**
- **Architectural change first, features second:** introduced
  `@nestjs/event-emitter` as a global event bus. `OrdersService` now emits
  `order.transitioned` on every validated status change (in addition to
  writing `OrderStatusHistory` as before), and `DispatchService` emits
  `delivery.otp_generated` when a rider marks pickup. This is what let
  three previously-flagged gaps get closed without creating the circular
  module dependencies that were blocking them:
  - **Auto-dispatch now actually works.** `DispatchService` listens for
    `order.transitioned` and calls `startDispatch` itself the instant a
    `DELIVERY`-type order hits `READY_FOR_PICKUP` — no more manual
    `POST /delivery/:orderId/dispatch` required in normal operation (the
    endpoint still exists as an admin retry fallback).
  - **The delivery OTP now actually reaches the customer.** Before this
    phase it was generated and stored but never sent anywhere.
    `NotificationsService` listens for `delivery.otp_generated` and
    notifies the customer — still never the rider.
  - **A real scheduler exists now.** `DispatchService.scheduledTimeoutSweep`
    runs every 30 seconds via `@Cron`, replacing "wait for a rider to poll
    or an admin to click sweep" as the only way expired offers got
    reclaimed. The manual admin sweep endpoint stays as a force-it-now
    option. Flagged limitation: this is a per-instance cron with no
    distributed lock — fine for one backend process, wasteful (not
    incorrect) if horizontally scaled later.
- **`NotificationsService`**: every notification is recorded as an in-app
  `Notification` row first (always), then best-effort attempted over email
  and/or SMS if the user has contact info — each channel's send
  success/failure is tracked independently, and a failed email/SMS never
  blocks the in-app record or throws back into whatever triggered it.
- **`EmailProvider`/`SmsProvider` abstractions**, same pattern as
  `PaymentProvider` (Phase 5) and `DistanceService` (Phase 7). The only
  implementations right now are console-logging stand-ins that clearly
  state in every log line whether they're faking a send because no API key
  is configured, or because no real adapter has been written yet even with
  a key present — never silently pretending a message was actually
  delivered.
- **`TrackingGateway`** (Socket.IO, §16): customers connect with their JWT
  access token in the handshake, call `subscribe_order` for one order
  (reusing `OrdersService.getOrderDetail`'s exact access-control rule, not
  a reimplementation of it), and receive an `order:status` event on every
  transition. **Not yet built**: live rider GPS position streamed to the
  customer — `RiderLocation` exists (Phase 6) but nothing pushes it over
  this socket yet. That's an additive next step on the same gateway, not a
  rewrite.
- Found and fixed a **pre-existing bug while wiring this up, not something
  Phase 9 introduced**: `OrderStatusHistory.changedByUserId` has existed
  since Phase 4 but was never actually being populated — every history row
  silently recorded `null` for who made the change. Fixed now: vendor
  actions record the vendor's user id, rider actions record the rider's,
  and the field is honest going forward. (Historical rows created before
  this fix will still show `null` — there's no way to retroactively
  recover who made those changes.)

**Phase 10 — Financial Ledger, Settlements, Analytics, and closing two
Phase 8 gaps:**
- **`LedgerEntry`** (§20, §35): append-only, nothing ever `UPDATE`s or
  `DELETE`s a row. Vendor/rider/platform balances are always *derived* by
  summing entries at query time — never a stored, mutable column.
  **Scope flag**: this is a **single-entry** ledger (each entry credits or
  debits one account), not full double-entry bookkeeping where every entry
  has a matching opposite so the books always net to zero. Single-entry
  answers "what do we owe vendor X" and gives an audit trail, which is what
  §35/§36 actually ask for — but a real accounting system for tax/financial
  statements would want proper double-entry. Said plainly here rather than
  presented as more rigorous than it is.
- **Event-driven booking**, continuing the Phase 9 pattern: `LedgerService`
  listens for `payment.succeeded` (books the gross `CUSTOMER_PAYMENT`) and
  for `order.transitioned` reaching `DELIVERED` (books `VENDOR_EARNING`,
  `PLATFORM_COMMISSION`, and — for platform-delivery orders with an
  assigned rider — `RIDER_EARNING`). Booking happens at **delivery**, not
  at payment, deliberately: an order that's paid but later cancelled never
  reaches `DELIVERED` in the state machine, so it can't accidentally
  generate an earning that later needs to be clawed back.
- **Known simplification, flagged**: the rider gets the *full* delivery fee
  as their earning — there's no admin-configurable platform cut of the
  delivery fee, because §18/§78 don't specify a concrete split to hard-code.
  One line in `LedgerService.onOrderTransitioned` to change if you want one.
- **Settlements/payouts (§77, §78)**: `POST /admin/settlements/vendors/:id/settle`
  and `.../riders/:id/pay` zero out a pending balance by recording a
  negative `PAYOUT` entry. **This does not execute a bank transfer** —
  per §77's own instruction ("actual settlement execution should be
  integrated only after the payment/financial architecture is properly
  configured and compliant"), clicking this just asserts "I paid this
  outside the system" and creates the accounting/audit trail for it.
- **`AnalyticsService`** (§36, §60, §61): date-filtered GMV (delivered
  orders only), platform revenue, delivery revenue, rider payouts, average
  order value, order-status counts, and top vendors/products/locations.
  **Refunds always read 0** right now — there's still no admin
  cancel-with-refund flow (a pre-existing gap, not new to this phase), so
  no `REFUND` ledger entries can exist yet to sum.
- **Closed: `AuditLog` was unused (flagged in Phase 8).** `AuditLogService`
  now actually gets called — vendor/rider approve/reject/suspend, category
  and location/service-area mutations, and both settlement actions all
  write a before/after audit record. **Not exhaustive**: order-level admin
  actions (cancel, refund, reassign) aren't audit-logged because those
  admin mutation endpoints mostly don't exist yet either (see "what's not
  implemented"). Whatever admin-mutating endpoint gets built next should
  pick up the same `AuditLogService.record()` pattern.
- **Closed: `AdminRole` sub-roles were unenforced (flagged in Phase 8).**
  New `AdminRolesGuard` + `@AdminRoles(...)` decorator, layered on top of
  the existing `@Roles(ADMIN)` check (never replacing it). Assigned:
  `VENDOR_ADMIN` → vendor endpoints, `RIDER_ADMIN` → rider endpoints,
  `CONTENT_ADMIN` → categories, `OPERATIONS_ADMIN` → locations/service
  areas, `FINANCE_ADMIN` → the new ledger/settlements/reports/audit-log
  endpoints. `SUPER_ADMIN` always passes everything. **Design note,
  flagged**: the guard looks up `adminRole` from the database on every
  request rather than reading it from the JWT, because the JWT payload
  (`{ sub, role }`) was never designed to carry it — reissuing every
  token's shape felt riskier than one extra indexed lookup on admin
  traffic (which is low-volume relative to customer traffic). Revisit if
  that assumption stops holding.
- **Admin frontend**: added a Finance page (`apps/admin/src/app/finance`) —
  date-range summary cards, pending vendor/rider balances with one-click
  settle/pay actions. This is the piece Phase 8's README explicitly said
  was "blocked on the ledger" — it isn't blocked anymore.

**Phase 11 — Testing and Security Pass:**

This phase found **real, exploitable bugs** during the audit — not a
checklist exercise. Listed plainly rather than folded quietly into a
changelog:

- **`RidersService.listPending()` returned full `User` rows (including
  `passwordHash`) to the admin API**, via an unguarded
  `include: { owner: true }`. Any admin session — and anyone who
  compromised one — could have pulled every pending rider applicant's
  password hash. Fixed with an explicit `select`.
- **`commissionRate` (and `ownerUserId`) leaked on every public and
  customer-facing vendor response** — public vendor browsing, product
  search, cart contents, and order history all embedded the raw `Vendor`
  row via `vendor: true`. The platform's commission rate per vendor is
  meant to be private; it was readable by anyone, unauthenticated, on the
  product listing endpoint. Fixed with one shared `PUBLIC_VENDOR_SELECT`
  constant (`src/modules/vendors/vendor-public-select.ts`) applied
  everywhere a vendor is shown to anyone other than the vendor themselves
  or an admin.
- **Caught while fixing the above, before it shipped**: `getOrderDetail`'s
  access-control check reads `order.vendor.ownerUserId` to verify a vendor
  is looking at their own order — the safe-select would have silently
  broken that and locked vendors out of their own orders. Fixed by
  fetching it specifically for the permission check and stripping it back
  out of the response afterward.
- **The rider "my delivery offers" endpoint could structurally return the
  delivery OTP** (`deliveryCode`) — it used `include` on the full `Order`,
  which returns every scalar field regardless of which relations you
  asked for. Not exploitable *today* only because of transition timing
  (offers only exist before pickup, when the code is still null) — which
  is not a safe thing to depend on. Rebuilt with an explicit `select` so
  the field structurally cannot reach a rider, independent of order state.
- Restricted the admin delivery list so it stops handing rider bank
  account details to any generic admin, and added the same
  `AdminRoles(OPERATIONS_ADMIN)` scoping to delivery admin endpoints that
  Phase 10 applied elsewhere (they'd been missed).
- **CORS was wide open**: `origin: true` (reflected and allowed any request
  origin) combined with `credentials: true` meant any website could make
  authenticated requests using a logged-in user's session. Same issue on
  the Socket.IO gateway (`origin: '*'`). Both now read a `CORS_ORIGIN`
  allowlist from the environment, falling back to allow-all **only** with
  a loud startup warning, so local dev isn't broken by the fix but nobody
  ships the fallback silently.
- Added baseline password complexity (letter + number, on top of the
  existing 8-character minimum) and a hard refusal for `prisma/seed.ts` to
  run at all when `NODE_ENV=production` — that script creates a
  known-password super-admin account and demo data, which has no business
  existing on a production database regardless of whether
  `SEED_ADMIN_PASSWORD` was remembered.
- **A real test suite**, not just a security audit — see `TESTING.md` for
  the full breakdown: unit tests for `OrderStateMachine`, the ledger's
  commission math, `AdminRolesGuard`, and the cart's single-vendor rule;
  plus an end-to-end test implementing §51's named critical scenario
  verbatim (order → payment → fulfillment → auto-dispatch → OTP delivery
  → ledger booking) against a real HTTP server and database. **Explicitly
  not comprehensive** — auth guards in isolation, webhook signature
  verification, and the dispatch offer/timeout chain in isolation are
  still untested; see `TESTING.md`'s "what does NOT exist yet" section.

**Phase 12 — Deployment Configuration:**
- `backend/Dockerfile` (multi-stage: build then a slim production image)
  and `apps/admin/Dockerfile` (Next.js standalone output, so the runtime
  image doesn't carry the full `node_modules` tree).
- `backend/docker-entrypoint.sh` runs `prisma migrate deploy` before
  starting the app by default — convenient for a single-instance
  deployment, **explicitly documented as unsafe for multiple concurrent
  replicas** (migration race), with a `SKIP_MIGRATIONS=true` escape hatch
  for when migrations are run as their own release step instead.
- Root `docker-compose.yml` wires up Postgres + backend + admin together.
  **Deliberately not a production topology** — local Postgres volume, and
  it says so in its own header comment. Runs the backend with
  `NODE_ENV=development` on purpose (not a leftover default): a real
  production deployment must override this, and the comment in the file
  explains exactly why development is what this compose setup wants
  (enables seeding and the dev payment stub for demoing the order
  lifecycle without live Paystack keys).
- **Caught and fixed a self-contradiction while writing this**: the
  compose file originally set `NODE_ENV=production` for convenience, which
  would have made the Phase 11 seed-script safety guard refuse to run —
  directly contradicting this same file's own seeding instructions. Fixed
  before it shipped, not after being pointed out.
- A GitHub Actions CI workflow (unit tests, e2e tests against a real
  Postgres service container, and a build step for both apps). **Never
  actually run** — this project has never been pushed to a real GitHub
  repo. Written against the real `package.json` scripts, and fixed one
  real problem found while writing it: the workflow originally used
  `npm ci`, which hard-requires a committed `package-lock.json` that
  doesn't exist (this project has never had `npm install` run in it) —
  switched to `npm install` with a comment explaining when to switch back.
- `PRODUCTION_CHECKLIST.md`: an honest, item-by-item pass over §101's own
  list, distinguishing "implemented" from "verified by actually running
  it" for every single item — including flatly marking migrations, the
  test suite, both app builds, and the deployment itself as **unverified**,
  because none of them have ever actually been executed in this project's
  history. This isn't hedging — it's the same standing caveat that's been
  attached to every phase, made explicit and comprehensive in one place
  now that "deployment" is the phase where that caveat matters most.

## Open design flags carried from earlier phases (not resolved, not forgotten)

- **RiderStatus.ACTIVE** (from Phase 6, still open): the spec lists
  `PENDING → UNDER_REVIEW → APPROVED → ACTIVE → SUSPENDED` without defining
  how `ACTIVE` differs from simply being online. This build treats
  `APPROVED` as "cleared to work" and auto-promotes to `ACTIVE` the first
  time the rider goes online, with `isOnline` as a fully separate toggle.
  If you intended `ACTIVE` to be a distinct admin action, it's a one-line
  change in `RidersService.goOnline`.
- **`goOffline()` doesn't block a rider mid-delivery** (from Phase 6, still
  open): a rider can call `POST /rider/me/go-offline` while
  `RIDER_ASSIGNED`/`PICKED_UP`/etc. Should be blocked or trigger an
  admin-alerting reassignment — pick one and I'll wire it in.
- ~~`AuditLog` unused and `AdminRole` unenforced~~ **Resolved in Phase 10**
  — see the section above. Not exhaustive (order-admin actions still
  aren't audit-logged, because those endpoints mostly don't exist), but
  the mechanism now works and is used.
- **New from Phase 10**: refund/cancel-with-refund for admins isn't built,
  so `REFUND` ledger entries and the refunds figure in reports will always
  read 0. This was already true before (no admin refund endpoint existed),
  but it's now visible as a specific "always zero" line in the Finance page
  rather than an abstract gap.
- **`AdminRolesGuard` looks up `adminRole` from the database on every
  admin request rather than the JWT** (from Phase 10, reconsidered and
  left as-is during the Phase 11 security pass): still the right tradeoff
  at current admin traffic volumes, but worth revisiting if that changes.

## What is NOT implemented yet

Promotions, reviews, support tickets, homepage CMS, advertising,
customer/vendor/rider frontends (only admin has a UI), admin refund/
cancel-with-refund (so `REFUND` ledger entries can't exist yet), and full
test coverage (a real but partial suite exists — see `backend/TESTING.md`
for exactly what's covered and what isn't). Also not done: live rider GPS
streamed over the tracking socket (only status changes are pushed so far),
real email/SMS provider integration (console stand-ins only, same
"awaiting credentials" honesty as Paystack), and a fuller §95
location-activation checklist (still just "has a delivery zone").






## Setup

```bash
cd backend
cp .env.example .env
npm install
docker compose -f ../docker-compose.yml up -d   # starts Postgres
npm run prisma:migrate                          # creates/updates tables
npm run prisma:seed                             # demo locations, categories, vendor types, admin
npm run start:dev
```

Demo admin login after seeding: `admin@example.com` /
`ChangeMe123!` (or your `SEED_ADMIN_PASSWORD`) — **change before any real
deployment.**

For the admin dashboard frontend, see `apps/admin/README.md` — it needs
the backend above running first.

For running the test suite, see `backend/TESTING.md`. For deploying with
Docker, see `DEPLOYMENT.md`. For an honest pre-launch checklist, see
`PRODUCTION_CHECKLIST.md`.

> I still don't have network access in the environment I'm building this
> in, so I have not run `npm install` or booted this. Please run it and
> tell me what breaks so I can fix it, rather than me guessing it's clean.

## All 12 phases done — what's next

Per your own instruction, the plan now is to revisit the accumulated open
items rather than declare this finished. In rough priority order:

1. **Actually run it.** Every "⚠️ unverified" line in
   `PRODUCTION_CHECKLIST.md` is a higher-value next step than any new
   feature — an untested 12-phase build is a hypothesis, not a working
   system, until someone boots it.
2. **Customer, vendor, and rider frontends.** The single biggest gap:
   only admin has a UI. Nothing in this repo is usable by an actual
   customer, vendor, or rider yet, regardless of how complete the backend
   is.
3. **The refund/cancel-with-refund gap** (flagged since Phase 10) — no
   admin path exists to reverse a payment.
4. **The smaller open design flags** listed above: `RiderStatus.ACTIVE`
   semantics, `goOffline()` not blocking mid-delivery, live rider GPS on
   the tracking socket, real email/SMS providers replacing the console
   stand-ins, and a fuller §95 location-activation checklist.
5. Promotions, reviews, support tickets, homepage CMS, and advertising —
   the remaining spec sections with no backend module at all yet.

## Testing Phase 5 without live Paystack keys

Set `PAYSTACK_SECRET_KEY` to any Paystack **test** secret key (starts
`sk_test_`) to exercise the real flow end-to-end against Paystack's
sandbox. Without a key at all, `/api/payments/initialize` fails clearly
with "awaiting Paystack credentials" rather than pretending to succeed. If
you want to test the order lifecycle *without* touching Paystack at all,
use `/api/orders/:id/dev-mark-paid` (development only) as before — it now
runs through the exact same `confirmPayment()` transition code the real
webhook uses, so it's a faithful stand-in for what payment success
triggers, just without the Paystack round-trip.


## Phase 12 — Deployment

Phase 12 adds the deployment/release documentation, backend health endpoint, Docker health checks, all-four-frontend CI builds, backend migration/test/build CI, and production migration guidance. Production verification still requires an actual CI run and deployed PostgreSQL environment.

## ROZZI — Windows / VS Code quick start

### Prerequisites
- Node.js 20 LTS or newer
- npm 10+
- PostgreSQL 16+ running locally, or Docker Desktop

### First run
```powershell
npm run setup
npm install
npm run prisma:generate
npm run prisma:deploy
npm run seed:local
npm run dev
```

Applications:
- Customer: http://localhost:3002
- Vendor: http://localhost:3003
- Rider: http://localhost:3004
- Admin: http://localhost:3001
- API: http://localhost:4000/health

### Important
`seed:local` is demo-only and refuses to run with `NODE_ENV=production`.
Never commit `.env`, `backend/.env`, or any production secret. For production, use a managed PostgreSQL database, a secret manager, real payment/email/SMS credentials, an S3-compatible bucket, HTTPS, backups, monitoring, and a separate migration/release step.

### If PostgreSQL is not installed
Use Docker Desktop and run:
```powershell
docker compose up postgres -d
```
Then use the default local `DATABASE_URL` from `backend/.env.example`.

## Production deployment

Use `docker-compose.production.example.yml` as a single-server production starting point. It intentionally does **not** run PostgreSQL inside the application stack; set `DATABASE_URL` to a managed PostgreSQL instance. Put the backend behind HTTPS and run Prisma migrations as a separate release step for multi-replica deployments (`SKIP_MIGRATIONS=true`).

Do not treat a successful Docker build as proof that payments, SMS, email, storage, backups or webhooks are production-verified. Those require real infrastructure/provider credentials and smoke tests.


### CORS remediation

The API and Socket.IO gateway now use the same comma-separated `CORS_ORIGIN` allowlist. In local development, if it is omitted, only the ROZZI frontend ports `3001`–`3004` are allowed; production requires an explicit `CORS_ORIGIN`.
