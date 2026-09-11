# Rozzi — Refund/Finance Phase checkpoint

Implemented:
- RefundStatus + Refund persistence model.
- Admin FINANCE_ADMIN refund endpoint: POST /api/admin/refunds/:orderId.
- Provider-backed refund execution through the existing PaymentProvider interface.
- Refund idempotency for active/processed attempts.
- Successful refunds mark the Payment REFUNDED.
- Pre-delivery orders can transition to REFUNDED through OrderStateMachine.
- Delivered orders remain DELIVERED; the refund is represented financially instead of rewriting operational history.
- REFUND ledger booking is event-driven and append-only.
- DTO validation for refund reason/amount.

Important verification status:
- npm install timed out in this environment, so TypeScript/Prisma generation and tests have NOT been claimed green.
- The project still needs a complete baseline Prisma migration history; the new refund migration assumes the existing schema is already present.
