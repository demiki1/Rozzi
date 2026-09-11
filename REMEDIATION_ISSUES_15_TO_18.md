# ROZZI Remediation — Issues 15 to 18

## 15 — Private object-storage authorization

- Storage upload presigning now creates a `MediaAsset` owned by the authenticated user.
- Download URLs require the requester to own the asset or be an admin.
- Non-uploaded private assets cannot be downloaded by ordinary users.
- Added an authenticated `POST /api/storage/complete` step that verifies the object exists before marking it uploaded.
- S3 credentials remain environment-provided; no credentials are packaged.

## 16 — Admin authentication storage

- Removed admin access/refresh token persistence from `localStorage`.
- Admin access tokens are memory-only.
- Admin login requests an HttpOnly refresh cookie.
- Admin refresh rotates the refresh token server-side and returns only a fresh access token.
- Admin API requests include credentials so the browser sends the HttpOnly refresh cookie.
- Cookie behavior is configurable through `AUTH_REFRESH_COOKIE_NAME`, `AUTH_COOKIE_SECURE`, and `AUTH_COOKIE_SAMESITE`.

## 17 — Idempotent local seed

- Location, service-area, delivery-zone, category, vendor-type, and demo-admin seeding is now repeatable.
- Existing demo records are reused or updated instead of blindly duplicated.
- `SEED_ADMIN_PASSWORD` is now mandatory; the predictable default password has been removed.
- Production seeding remains explicitly blocked.

## 18 — Rider cannot go offline during an active delivery

- The existing delivery-state check is now treated as an enforced invariant rather than a future TODO.
- A rider with an undelivered order in any active delivery state is rejected when attempting to go offline.
- Added a focused unit test proving that the rider is not updated when an active delivery exists.
