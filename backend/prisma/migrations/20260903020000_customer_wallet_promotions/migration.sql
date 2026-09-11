CREATE TYPE "WalletTransactionType" AS ENUM ('TOP_UP','ORDER_PAYMENT','REFUND','PROMOTIONAL_CREDIT','CASHBACK','REFERRAL_REWARD','WITHDRAWAL','ADJUSTMENT');
CREATE TYPE "WalletTransactionStatus" AS ENUM ('PENDING','SUCCESS','FAILED','REVERSED');
CREATE TYPE "WalletWithdrawalStatus" AS ENUM ('REQUESTED','PROCESSING','PAID','REJECTED','FAILED');
ALTER TYPE "PaymentProviderName" ADD VALUE IF NOT EXISTS 'WALLET';

CREATE TABLE "wallets" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "wallets_customerId_key" ON "wallets"("customerId");
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "wallet_transactions" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "type" "WalletTransactionType" NOT NULL,
  "status" "WalletTransactionStatus" NOT NULL DEFAULT 'PENDING',
  "amount" INTEGER NOT NULL,
  "balanceBefore" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "reference" TEXT NOT NULL,
  "description" TEXT,
  "orderId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "wallet_transactions_reference_key" ON "wallet_transactions"("reference");
CREATE INDEX "wallet_transactions_customerId_createdAt_idx" ON "wallet_transactions"("customerId","createdAt");
CREATE INDEX "wallet_transactions_walletId_createdAt_idx" ON "wallet_transactions"("walletId","createdAt");
CREATE INDEX "wallet_transactions_orderId_idx" ON "wallet_transactions"("orderId");
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON UPDATE CASCADE;
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "wallet_withdrawals" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" "WalletWithdrawalStatus" NOT NULL DEFAULT 'REQUESTED',
  "bankName" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "accountNumberLast4" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "reason" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wallet_withdrawals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "wallet_withdrawals_reference_key" ON "wallet_withdrawals"("reference");
CREATE INDEX "wallet_withdrawals_customerId_createdAt_idx" ON "wallet_withdrawals"("customerId","createdAt");
CREATE INDEX "wallet_withdrawals_walletId_status_idx" ON "wallet_withdrawals"("walletId","status");
ALTER TABLE "wallet_withdrawals" ADD CONSTRAINT "wallet_withdrawals_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "promotion_redemptions" (
  "id" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "orderId" TEXT,
  "discountAmount" INTEGER NOT NULL,
  "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "promotion_redemptions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "promotion_redemptions_promotionId_customerId_idx" ON "promotion_redemptions"("promotionId","customerId");
CREATE INDEX "promotion_redemptions_customerId_redeemedAt_idx" ON "promotion_redemptions"("customerId","redeemedAt");
ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "promotion_redemptions_promotionId_customerId_orderId_key" ON "promotion_redemptions"("promotionId","customerId","orderId");
