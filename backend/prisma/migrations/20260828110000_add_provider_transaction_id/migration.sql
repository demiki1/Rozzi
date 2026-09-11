-- Issue 12: persist provider-side transaction IDs so Flutterwave redirects,
-- webhooks and refunds can use the authoritative provider transaction ID.
ALTER TABLE "payments" ADD COLUMN "providerTransactionId" TEXT;
CREATE INDEX "payments_providerTransactionId_idx" ON "payments"("providerTransactionId");
