CREATE TYPE "VendorPaymentAccountStatus" AS ENUM ('PENDING', 'VERIFIED', 'SUSPENDED');
CREATE TYPE "VendorPayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED');

CREATE TABLE "vendor_payment_accounts" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "bankCode" TEXT,
  "accountName" TEXT NOT NULL,
  "accountNumberLast4" TEXT NOT NULL,
  "providerAccountId" TEXT,
  "payoutMethod" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
  "status" "VendorPaymentAccountStatus" NOT NULL DEFAULT 'PENDING',
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vendor_payment_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vendor_payment_accounts_vendorId_key" ON "vendor_payment_accounts"("vendorId");
ALTER TABLE "vendor_payment_accounts" ADD CONSTRAINT "vendor_payment_accounts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "vendor_payouts" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" "VendorPayoutStatus" NOT NULL DEFAULT 'PENDING',
  "reference" TEXT NOT NULL,
  "bankName" TEXT,
  "accountName" TEXT,
  "accountNumberLast4" TEXT,
  "ledgerEntryId" TEXT,
  "failureReason" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vendor_payouts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vendor_payouts_reference_key" ON "vendor_payouts"("reference");
CREATE UNIQUE INDEX "vendor_payouts_ledgerEntryId_key" ON "vendor_payouts"("ledgerEntryId");
CREATE INDEX "vendor_payouts_vendorId_createdAt_idx" ON "vendor_payouts"("vendorId", "createdAt");
CREATE INDEX "vendor_payouts_status_idx" ON "vendor_payouts"("status");
ALTER TABLE "vendor_payouts" ADD CONSTRAINT "vendor_payouts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
