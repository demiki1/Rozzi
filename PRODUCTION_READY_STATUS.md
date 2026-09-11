# ROZZI Production Readiness Status

## What this checkpoint guarantees

This repository is prepared for local development in VS Code and for a single-server production deployment pattern. It includes the customer, vendor, rider and admin applications, backend API, Prisma migrations, health checks, security guards, payment-provider abstraction, object-storage abstraction, notification-provider abstraction, Dockerfiles, CI configuration and production environment templates.

## What cannot be truthfully marked verified from the build environment

The final production gate still requires execution against a real environment:

1. `npm install`
2. `npm run prisma:generate`
3. `npm run prisma:deploy`
4. `npm run test:backend`
5. `npm run test:e2e`
6. `npm run build:backend`
7. `npm run build:apps`
8. Docker image builds and container health checks
9. Browser smoke tests for all four applications
10. Live payment webhook tests in provider test/live mode

Those checks must be performed on the user's Windows/VS Code machine or CI runner because the packaging environment may not have PostgreSQL, Docker, npm package cache, provider credentials, DNS or HTTPS.

## Production infrastructure required

- Managed PostgreSQL with automated backups and point-in-time recovery where available.
- HTTPS/TLS at the edge.
- Secret manager/environment-injected secrets.
- Paystack and/or Flutterwave live credentials plus webhook endpoints.
- S3-compatible storage bucket with private document access and appropriate lifecycle/retention rules.
- Real Resend/Termii credentials if email/SMS are enabled.
- Monitoring and centralized logs.
- A separate migration/release step for multi-replica deployments.
- A rollback procedure and database backup verification.

Never use the local demo seed against a production database.
