# ROZZI Rider Phase 2 — Money

Source-level implementation: earnings, wallet, payout requests/history, cash management, transactions and payout accounting.

Runtime verification intentionally remains pending until dependencies are installed, Prisma is generated/migrated, and the backend/frontend are built and exercised against PostgreSQL.

Actual bank transfer execution is not claimed; payout requests are recorded and admin settlement can mark them paid through the existing finance architecture.
