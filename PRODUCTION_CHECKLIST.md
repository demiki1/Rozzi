# Production Readiness Checklist

Per §101's own list. Every item below is marked with its **actual**
status — not what "should" be true, but what's been built and, separately,
what's been verified by actually running it. This project has never been
booted in the environment it was built in (no network access), so
"implemented" and "verified" are different claims throughout this
document, and that distinction is deliberate, not sloppy.

Legend: ✅ implemented & code-reviewed · ⚠️ implemented but NOT run/verified
· ❌ not implemented · 🚫 out of scope for this project as built

| Item | Status | Notes |
|---|---|---|
| Authentication works | ⚠️ | JWT + bcrypt + refresh rotation implemented (Phase 1). Never booted against a real client. |
| Authorization works | ⚠️ | Role guards + `AdminRole` sub-role guards implemented (Phases 1, 10). Unit-tested (`AdminRolesGuard`) but not the base `RolesGuard`/`JwtAuthGuard`. |
| Database migrations work | ❌ | Migrations have never actually been run — no `prisma migrate dev` has ever executed against a real Postgres in this project's history. The schema is believed consistent (careful manual review each phase) but genuinely unverified. **Run this first, before anything else, and expect to fix something.** |
| Payment verification works | ⚠️ | Paystack adapter implemented with real HTTP calls to Paystack's API (Phase 5), never actually called — no live or test Paystack key has ever been used against this code. |
| Webhooks work | ⚠️ | Signature verification logic implemented against Paystack's documented HMAC-SHA512 scheme; never received an actual webhook. |
| Orders work | ⚠️ | Full state machine + transactional checkout (Phase 4), exercised in the Phase 11 e2e test — which itself has never been run. |
| Vendor workflow works | ⚠️ | Registration → approval → product management → order queue implemented across Phases 2–4; partially covered by the e2e test. |
| Rider workflow works | ⚠️ | Registration → approval → go-online → dispatch implemented across Phases 6–7; partially covered by the e2e test. |
| Delivery assignment works | ⚠️ | Nearest-rider offer chain + auto-dispatch via event listener (Phases 7, 9); covered by the e2e test's happy path only — decline/timeout/reassignment branches are NOT covered by any test. |
| OTP delivery confirmation works | ⚠️ | Implemented (Phase 7), notification-delivered (Phase 9), and the wrong-code-rejection path is covered by the e2e test. |
| Refund logic works | ❌ | **Does not exist.** No admin refund/cancel-with-refund endpoint was ever built. `REFUND` ledger entries can never be created. Flagged repeatedly since Phase 10 — still not closed. |
| Admin permissions work | ⚠️ | `AdminRole` sub-role enforcement implemented and unit-tested (Phase 10). Coverage is not exhaustive — see `TESTING.md`. |
| Location restrictions work | ⚠️ | Service-area scoping on vendor/product visibility implemented since Phase 2; not independently tested (only indirectly via the e2e test using one service area). |
| Rate limiting works | ⚠️ | Global 100/min + login-specific 5/min via `@nestjs/throttler` (Phase 1); never load-tested. |
| Secrets are protected | ✅ / ⚠️ | No secret is hard-coded anywhere in source (checked). Whether your actual deployment protects them (secret manager vs plaintext `.env` on a server) is on you — see the compose file's warning. Rider bank details and admin audit logs contain sensitive data at rest with no field-level encryption; that's a real gap for a payments-adjacent product, not addressed in this project. |
| Logs work | ⚠️ | NestJS `Logger` used throughout for warnings/errors (payment failures, dispatch failures, audit-relevant events). No log aggregation, retention policy, or PII-scrubbing has been set up — that's infrastructure-level and hasn't been addressed. |
| Backups are configured | ❌ | Nothing in this repo configures database backups. This is entirely an infrastructure/hosting decision outside the application code — whatever manages your Postgres instance needs point-in-time recovery or scheduled dumps configured there. |
| Error handling works | ✅ | Global exception filter (`AllExceptionsFilter`, Phase 1) gives a consistent `{ success, error }` shape and never leaks stack traces to clients. Verified by code review, not by triggering real errors against a running server. |
| Tests pass | ❌ | Tests exist (Phase 11) but have never been run. "Tests pass" cannot be claimed until someone actually runs `npm test` and `npm run test:e2e` and they come back green. |
| Build succeeds | ❌ | `npm run build` (backend) and `npm run build` (admin) have never been executed. TypeScript errors, missing dependencies, or version mismatches would only surface at that point, and none of that has happened yet. |
| Deployment works | ❌ | The Dockerfiles and compose file in this phase are written but, per the project's standing caveat, never built or run. |
| 🚫 Kubernetes / complex orchestration | 🚫 | Explicitly out of scope per §97 — this is a modular monolith with a single Dockerfile per app, not a microservices/K8s setup. |

## What this means practically

Before this goes anywhere near real users:

1. **Run it.** `docker compose up`, or the manual `npm install` / `npm run
   start:dev` path in each README. This is the single highest-value next
   action — everything marked ⚠️ above turns into either ✅ or a bug report
   the moment someone actually boots this.
2. Run the migration (`npx prisma migrate dev` locally, or `migrate
   deploy` in the container) against a real Postgres and fix whatever the
   first attempt surfaces — schema drift across 12 phases of hand-written
   Prisma edits is a very plausible source of a typo or a missing
   back-relation that code review alone won't catch.
3. Run the test suite and treat any failure as expected-and-useful
   information, not a sign something went wrong with the build process.
4. Get a Paystack **test-mode** secret key and actually exercise
   `/api/payments/initialize` and a real webhook delivery before trusting
   that integration.
5. Decide what to do about the refund gap before processing real money —
   right now, a payment that needs to be reversed has no system-supported
   path.
6. Address the "Secrets/logs/backups" infrastructure items — these are
   deliberately outside what application code can solve; they're
   decisions about where and how you host this.

Nothing above is meant to undermine confidence in the code that exists —
each phase was built carefully and cross-checked by hand against real
route names, DTOs, and Prisma relations. But "carefully written" and
"production-ready" are different claims, and conflating them is exactly
the failure mode §100 and §101 were written to prevent.

## Phase 12 additions

- [ ] CI has run successfully in the real repository
- [ ] Backend `/health` returns database `ok` in the deployed environment
- [ ] Production migrations have been applied by a one-off release job
- [ ] All four frontend builds have passed in CI
- [ ] Backend unit and E2E suites have passed in CI
- [ ] Production CORS allowlist is configured
- [ ] Production JWT secrets are strong and non-default
- [ ] Paystack credentials/webhooks are configured and verified before enabling live payments
