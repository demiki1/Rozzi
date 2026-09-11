# ROZZI Stage 9 — Security & Permissions Hardening

## Completed

- Corrected authenticated user identity handling in account, wallet, favorites, and address controllers (`req.user.id` → JWT `userId`).
- Restricted customer wallet and favorites endpoints to `CUSTOMER`.
- Restricted standalone customer address endpoints to `CUSTOMER`.
- Restricted review creation/history to `CUSTOMER`; public review summaries/listings are explicitly public.
- Kept vendor product/options/inventory/advanced endpoints role-scoped and ownership-enforced.
- Kept finance, admin operations, settings, refunds, and audit-log routes behind admin role guards.
- Made refresh-token rotation atomic so concurrent reuse of one refresh token cannot mint multiple sessions.
- Re-checks account active state when refreshing a token.
- Preserved strict CORS allowlisting and production secret checks.
- Removed local `.env` / `.env.local` files from the distributable package; only example environment files are shipped.

## Security invariants

1. REST authentication is required globally unless a route is explicitly `@Public()`.
2. Role-scoped routes use `RolesGuard`; admin sub-roles additionally use `AdminRolesGuard`.
3. Resource ownership remains enforced in services for customer/vendor/rider resources.
4. WebSocket connections require JWT authentication and order subscriptions reuse order authorization.
5. Provider webhooks remain public only because they authenticate via provider signature verification.
6. Delivery OTP remains customer-only and is never exposed through rider APIs.
7. Development payment stubs remain disabled in production.
