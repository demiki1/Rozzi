# ROZZI Database Migration Remediation

## What was wrong

The migration directory contained a complete `20260825000000_initial_baseline` migration and then several later migrations that attempted to create tables, enums, indexes, and columns that were already present in that baseline.

Examples included refunds, password reset/verification tokens, media, advertisements, banners, reviews, promotions, support tables, delivery groups, rider tips, `deliveryModel`, `scheduledFor`, and `ledger_entries.idempotencyKey`.

A fresh `prisma migrate deploy` could therefore fail on duplicate database objects.

## Fix

The baseline migration already represents the current Prisma schema, so the redundant follow-up migrations were removed from the distributable project. The migration history is now a clean single baseline for a fresh database.

A PostgreSQL Prisma migration lock file was also added.

## Important for an existing development database

This remediation is intended for the pre-production project before any real users/data are deployed. If a local database already contains the old migration history, do not mix the old and new histories. For local development, recreate/reset that disposable database and run the clean baseline.

Do not reset any production database.

## Verification still required

The migration files have been structurally audited, but the final proof is still to run against a real PostgreSQL instance:

```powershell
npm run prisma:generate
npm run prisma:deploy
```

A fresh database should reach the end of the baseline migration without duplicate-object errors.
