# ROZZI Stage 5 — Payments, Wallet, Refunds & Money Bridge

## Completed
- Added first-class customer wallet payment for existing `PENDING_PAYMENT` orders.
- Wallet payments create a normal `Payment` row with provider `WALLET`, a `PaymentEvent`, a successful wallet transaction, and reuse the existing payment-success event/ledger flow.
- Customer order page now exposes wallet payment and external online payment actions.
- Paystack/Flutterwave checkout callbacks return to the Customer app and re-verify server-side.
- Paystack refund webhooks now settle pending refund attempts when provider confirmation arrives.
- Wallet refunds credit the customer wallet atomically and mark the payment `REFUNDED` when fully refunded.
- Customer wallet page added for balance, top-up, withdrawal request and recent transactions.
- Wallet top-up and withdrawal balance mutations use serializable transactions to reduce double-spend/race risks.
- Existing vendor/rider ledger and admin settlement architecture preserved.

## Money flow
Customer payment → Payment → Ledger customer-payment inflow → delivered-order allocation → vendor/rider/platform balances → payout/settlement.
Refunds create compensating ledger entries and, for wallet payments, return funds directly to the customer wallet.

## Honest scope
Vendor/rider settlement buttons still record a payout/settlement in the existing ledger; they do not execute a bank transfer. Real payout execution requires configured compliant payout-provider credentials and operational controls.
