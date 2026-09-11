# Marketplace Admin Dashboard

Next.js (App Router) admin frontend for the marketplace/delivery backend.
This is the **first frontend app** in the project — everything before Phase
8 was backend API only.

## Scope of this phase

Built: Overview (basic counts), Orders (list + detail/timeline), Vendors
(approval queue), Riders (verification queue), Locations (tree +
service areas + delivery zones), Categories (CRUD).

**Not built in this pass** — the remaining ~18 sections from spec §22, most
of which are blocked on backend work that doesn't exist yet:
- Vendor settlements, rider payouts, financial reports → need the ledger
  (Phase 10)
- Promotions, coupons, advertising → no backend module yet
- Homepage CMS (banners, featured vendors/products) → no backend module yet
- Notifications, support tickets, reviews → no backend module yet
- Audit log viewer → the `AuditLog` table exists (Phase 1) but nothing
  writes to it yet — no admin action in any phase so far actually creates
  an audit log entry. Flagging this explicitly: §39 asks for audit logging
  on admin actions, and it's not wired up. This should be treated as a gap
  to close, not something already covered.
- Admin roles/permissions UI → `AdminRole` exists on the `User` model
  (Phase 1) but every admin endpoint so far only checks
  `@Roles(UserRole.ADMIN)`, not the finer-grained `AdminRole` sub-roles
  (§38). Anyone with an ADMIN account can currently do anything an admin
  can do — the granular permission split from §38 is not enforced anywhere
  yet.
- Full vendor/rider search & management beyond the approval queue (e.g. an
  "all vendors" table with search/filter) — only pending-approval lists
  exist because that's all the current pages needed; a general listing
  endpoint doesn't exist on the backend yet either.

## Setup

```bash
cd apps/admin
cp .env.example .env.local
npm install
npm run dev
```

Runs on `http://localhost:3001` by default. Requires the backend running
(see `/backend/README.md`) and `NEXT_PUBLIC_API_URL` pointing at it.

Log in with the seeded admin account (`admin@example.com` /
`ChangeMe123!` unless you set `SEED_ADMIN_PASSWORD` differently).

> Same caveat as the backend: I have not been able to run `npm install` or
> `npm run dev` in my environment (no network access), so this has not
> actually been booted or visually verified. Please run it and tell me
> what breaks.

## Known simplification: auth token storage

Access/refresh tokens are kept in `localStorage`. That's simpler to wire up
than httpOnly cookies but more exposed to XSS. Flagged for the Phase 11
security pass rather than treated as a solved problem.
