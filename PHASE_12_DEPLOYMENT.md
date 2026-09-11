# Rozzi — Phase 12 Deployment & Production Readiness

Phase 12 is the final numbered implementation phase. It packages the marketplace for repeatable development/staging deployment and documents the production release boundary.

## Services

- Backend API: port 4000
- Admin: port 3001
- Customer: port 3002
- Vendor: port 3003
- Rider: port 3004
- PostgreSQL: local development only, port 5432

## Local/staging compose

`docker compose up --build` starts PostgreSQL, applies Prisma migrations through the backend entrypoint, waits for the backend health endpoint, then starts the four Next.js applications.

The compose database uses a local volume and is **not** a production database topology.

## Production release sequence

1. Provision a managed PostgreSQL database.
2. Configure production secrets in the platform secret manager.
3. Set `NODE_ENV=production`.
4. Set `CORS_ORIGIN` to the exact trusted frontend origins, comma-separated.
5. Set strong `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` values (32+ characters).
6. Configure Paystack credentials when payments are enabled.
7. Build and publish backend/admin/customer/vendor/rider images.
8. Run `npx prisma migrate deploy` as a **one-off release job** against the production database.
9. Start backend replicas with `SKIP_MIGRATIONS=true`.
10. Start frontend services.
11. Verify `/health` returns database `ok`.
12. Run smoke tests for authentication, marketplace browsing, checkout, vendor order handling, rider delivery and admin access.

Do not use the development payment-confirmation stub in production.

## Migration safety

The backend entrypoint supports automatic migrations for a single-instance development/staging deployment. For multiple backend replicas, run migrations separately before rollout and set `SKIP_MIGRATIONS=true` on the application containers.

## Secrets

Never commit `.env` files or production credentials. Use the deployment platform's secret manager. Public Next.js values such as `NEXT_PUBLIC_API_URL` are build-time configuration and must not contain secrets.

## Verification boundary

A successful build or written test is not the same as a verified production deployment. The final 108-point audit must distinguish:

- Verified locally/CI
- Implemented but awaiting provider credentials
- Not yet verified
- Still missing
