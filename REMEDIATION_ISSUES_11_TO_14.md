# ROZZI Remediation — Issues 11 to 14

## Issue 11 — Advertising/banner admin system
- Replaced the admin advertising page's enable/disable-only UI with create/edit/delete controls.
- Supports scheduling, placement, image URLs, mobile banner image, target URL, display order and active state.
- Existing backend role scoping and audit logging are preserved.

## Issue 12 — Flutterwave provider transaction ID
- Added `Payment.providerTransactionId` to Prisma.
- Flutterwave webhook stores the provider transaction ID after authoritative verification.
- Refunds use the stored provider transaction ID when available.
- Added a migration for the new nullable column.

## Issue 13 — Flutterwave redirect verification
- Payment verification endpoint accepts the provider `transaction_id` query parameter.
- Server-side verification calls Flutterwave's transaction verification endpoint and checks `tx_ref` and amount.
- Added a customer callback page that never trusts the browser's payment status.

## Issue 14 — Flutterwave refund completion
- Refunds now use `providerTransactionId` for Flutterwave instead of incorrectly treating ROZZI's internal reference as the provider transaction ID.
- Existing refund rows retain provider references and processed/failed state.
- The provider remains authoritative; ROZZI only marks a refund processed after the adapter reports a processed result.

Runtime verification is still required on a real PostgreSQL/Node environment with Flutterwave sandbox credentials.


## Additional financial integrity hardening
- Partial refunds no longer mark an entire payment as `REFUNDED`.
- Cumulative refund allocation is bounded by the successful payment amount.
- A pending refund attempt blocks duplicate submission for the same payment.
- Flutterwave's default redirect now points to the ROZZI customer callback route.
