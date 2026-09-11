CREATE TYPE "RiderPayoutStatus" AS ENUM ('REQUESTED','PROCESSING','PAID','FAILED','CANCELLED');
CREATE TYPE "RiderCashTransactionType" AS ENUM ('COLLECTION','REMITTANCE','ADJUSTMENT');

CREATE TABLE "rider_payouts" (
  "id" TEXT NOT NULL,
  "riderId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" "RiderPayoutStatus" NOT NULL DEFAULT 'REQUESTED',
  "reference" TEXT NOT NULL,
  "bankName" TEXT,
  "accountName" TEXT,
  "accountNumberLast4" TEXT,
  "ledgerEntryId" TEXT,
  "failureReason" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rider_payouts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "rider_payouts_reference_key" ON "rider_payouts"("reference");
CREATE UNIQUE INDEX "rider_payouts_ledgerEntryId_key" ON "rider_payouts"("ledgerEntryId");
CREATE INDEX "rider_payouts_riderId_status_createdAt_idx" ON "rider_payouts"("riderId","status","createdAt");
CREATE INDEX "rider_payouts_status_idx" ON "rider_payouts"("status");
ALTER TABLE "rider_payouts" ADD CONSTRAINT "rider_payouts_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rider_payouts" ADD CONSTRAINT "rider_payouts_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "ledger_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "rider_cash_transactions" (
  "id" TEXT NOT NULL,
  "riderId" TEXT NOT NULL,
  "deliveryId" TEXT,
  "orderId" TEXT,
  "type" "RiderCashTransactionType" NOT NULL,
  "amount" INTEGER NOT NULL,
  "description" TEXT,
  "evidenceUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rider_cash_transactions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "rider_cash_transactions_riderId_createdAt_idx" ON "rider_cash_transactions"("riderId","createdAt");
CREATE INDEX "rider_cash_transactions_riderId_type_idx" ON "rider_cash_transactions"("riderId","type");
CREATE INDEX "rider_cash_transactions_orderId_idx" ON "rider_cash_transactions"("orderId");
ALTER TABLE "rider_cash_transactions" ADD CONSTRAINT "rider_cash_transactions_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rider_cash_transactions" ADD CONSTRAINT "rider_cash_transactions_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rider_cash_transactions" ADD CONSTRAINT "rider_cash_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
