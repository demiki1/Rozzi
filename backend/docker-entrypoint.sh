#!/bin/sh
set -e

# HONEST LIMITATION, read before using this in a real deployment:
#
# Running `prisma migrate deploy` from the app container's own startup is
# convenient for a single-instance deployment (one backend container, one
# database) — it means "docker run" or "docker compose up" just works
# without a separate migration step to remember.
#
# It is NOT safe as-is for a multi-replica deployment (multiple backend
# containers starting concurrently against the same database): several
# containers could race to apply the same migration simultaneously.
# Prisma's migration table has some protection against this, but the
# correct production pattern is to run `prisma migrate deploy` as its own
# one-off release step (a CI/CD job, a Kubernetes Job, a Fly.io release
# command, etc.) BEFORE any app replica starts, and set
# SKIP_MIGRATIONS=true here so the app containers don't also try.
if [ "$SKIP_MIGRATIONS" != "true" ]; then
  echo "Running database migrations (set SKIP_MIGRATIONS=true to skip, e.g. in a multi-replica deployment where migrations run as a separate release step)..."
  npx prisma migrate deploy
else
  echo "SKIP_MIGRATIONS=true — skipping migrations, assuming they were already applied by a separate release step."
fi

exec "$@"
