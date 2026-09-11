# Rozzi Phase 11 — Security, Test Hardening & Production Guards

## Implemented
- Global NestJS throttling guard remains enabled.
- Authentication login endpoint has a tighter 5/minute throttle.
- Passwords require at least 8 characters, one letter, and one number, with a 72-character maximum to avoid bcrypt truncation ambiguity.
- Login uses identical invalid-credential responses for missing/inactive users and bad passwords.
- Refresh tokens are stored only as SHA-256 hashes and rotated on use.
- Paystack webhook signature verification uses HMAC-SHA512 and timing-safe comparison.
- Production startup requires `CORS_ORIGIN`.
- Production startup rejects missing/default JWT access/refresh secrets and requires 32+ character secrets.
- Socket.IO CORS uses the same configured allowlist; production does not fall back to `*`.
- Helmet and strict DTO whitelist/forbid-non-whitelisted validation remain enabled.
- Security unit tests cover webhook signatures, authentication enumeration behavior, order state transitions, admin roles, cart rules, ledger math, and password policy.

## Verification status
The code has been statically reviewed in this checkpoint. Full runtime verification still requires dependency installation, Prisma generation/migration, PostgreSQL, unit tests, E2E tests, and production builds.
