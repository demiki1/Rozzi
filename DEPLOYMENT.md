# Deployment

## Local / small-server (Docker Compose)

```bash
cp .env.example .env
# edit .env: set real JWT secrets at minimum

docker compose up --build
```

This starts Postgres, the backend (migrations run automatically on
container start — see `backend/docker-entrypoint.sh`), and the admin
frontend. Backend on :4000, admin on :3001, Postgres on :5432.

Seed demo data (categories, vendor types, a super-admin) once the backend
is up:

```bash
docker compose exec backend npx prisma db seed
```

## What this compose setup deliberately does NOT do

- **Manage real secrets.** The `.env` file is for convenience; a real
  deployment should pull `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and
  `PAYSTACK_SECRET_KEY` from your platform's secret manager, not a file
  sitting next to the code.
- **Run Postgres for production.** The `postgres` service here uses a
  local Docker volume — fine for development, not for anything you can't
  afford to lose. Use a managed database (RDS, Cloud SQL, etc.) in
  production and just point `DATABASE_URL` at it.
- **Handle horizontal scaling.** Running more than one `backend` replica
  against the same database currently has two known issues, both flagged
  in earlier phases: migrations racing on concurrent startup (mitigated by
  setting `SKIP_MIGRATIONS=true` and running migrations as a separate
  step — see `docker-entrypoint.sh`), and `DispatchService`'s `@Cron`
  timeout sweep running redundantly on every replica (wasteful, not
  incorrect, per the comment in that file — but a real multi-replica setup
  should use a single dedicated worker or a distributed lock instead).
- **Terminate TLS or run a reverse proxy.** Put this behind whatever your
  hosting platform provides (a load balancer, Caddy, nginx, Cloudflare) —
  nothing here listens on 443 or handles certificates.

## Platform-specific notes

Nothing in this repo is tied to a specific cloud provider — it's a
standard Dockerized Node.js API + a standard Dockerized Next.js app, both
buildable with the Dockerfiles in `backend/` and `apps/admin/`. Railway,
Render, Fly.io, a plain VM with Docker, or a container service on any
major cloud should all work without changes beyond setting the
environment variables each app's README documents.

## Before going live

See `PRODUCTION_CHECKLIST.md` — it is deliberately blunt about what's
actually been verified versus just written, per §100/§101's own
instructions not to claim something works before it's been checked.
