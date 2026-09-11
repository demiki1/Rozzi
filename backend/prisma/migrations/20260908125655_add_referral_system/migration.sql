-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'REGISTERED', 'FIRST_TRANSACTION', 'QUALIFIED', 'DELIVERED', 'VERIFIED', 'REWARDED', 'CLOSED', 'CANCELLED', 'REFUNDED', 'REVERSED', 'FRAUD_DETECTED', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "ReferralRiskStatus" AS ENUM ('CLEAR', 'REVIEW', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ReferralRewardStatus" AS ENUM ('PENDING', 'HELD', 'AVAILABLE', 'REVERSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReferralCreditLedgerType" AS ENUM ('CREDIT', 'REVERSAL', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "referral_program_configs" (
    "id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rewardRatePercent" DECIMAL(5,2) NOT NULL,
    "maxRewardAmount" INTEGER NOT NULL,
    "minimumTransactionAmount" INTEGER NOT NULL,
    "holdDurationMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_program_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "referralCode" TEXT NOT NULL,
    "attributionSource" TEXT,
    "attributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rewardRatePercent" DECIMAL(5,2) NOT NULL,
    "maxRewardAmount" INTEGER NOT NULL,
    "minimumTransactionAmount" INTEGER NOT NULL,
    "holdDurationMinutes" INTEGER NOT NULL,
    "qualifyingOrderId" TEXT,
    "qualifyingAmount" INTEGER,
    "rewardAmount" INTEGER,
    "riskStatus" "ReferralRiskStatus" NOT NULL DEFAULT 'CLEAR',
    "registeredAt" TIMESTAMP(3),
    "qualifiedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "rewardedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_rewards" (
    "id" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "ReferralRewardStatus" NOT NULL DEFAULT 'PENDING',
    "eligibleAt" TIMESTAMP(3),
    "holdUntil" TIMESTAMP(3),
    "creditedAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_credit_accounts" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_credit_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_credit_ledger" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "referralRewardId" TEXT,
    "type" "ReferralCreditLedgerType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_credit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_risk_events" (
    "id" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "riskStatus" "ReferralRiskStatus" NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_risk_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "referral_program_configs_isActive_idx" ON "referral_program_configs"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referredUserId_key" ON "referrals"("referredUserId");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_qualifyingOrderId_key" ON "referrals"("qualifyingOrderId");

-- CreateIndex
CREATE INDEX "referrals_referrerId_idx" ON "referrals"("referrerId");

-- CreateIndex
CREATE INDEX "referrals_status_idx" ON "referrals"("status");

-- CreateIndex
CREATE INDEX "referrals_riskStatus_idx" ON "referrals"("riskStatus");

-- CreateIndex
CREATE INDEX "referrals_referralCode_idx" ON "referrals"("referralCode");

-- CreateIndex
CREATE INDEX "referrals_createdAt_idx" ON "referrals"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "referral_rewards_referralId_key" ON "referral_rewards"("referralId");

-- CreateIndex
CREATE UNIQUE INDEX "referral_rewards_reference_key" ON "referral_rewards"("reference");

-- CreateIndex
CREATE INDEX "referral_rewards_referrerId_createdAt_idx" ON "referral_rewards"("referrerId", "createdAt");

-- CreateIndex
CREATE INDEX "referral_rewards_status_idx" ON "referral_rewards"("status");

-- CreateIndex
CREATE UNIQUE INDEX "referral_credit_accounts_customerId_key" ON "referral_credit_accounts"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "referral_credit_ledger_reference_key" ON "referral_credit_ledger"("reference");

-- CreateIndex
CREATE INDEX "referral_credit_ledger_customerId_createdAt_idx" ON "referral_credit_ledger"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "referral_credit_ledger_accountId_createdAt_idx" ON "referral_credit_ledger"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "referral_credit_ledger_type_idx" ON "referral_credit_ledger"("type");

-- CreateIndex
CREATE UNIQUE INDEX "referral_credit_ledger_referralRewardId_type_key" ON "referral_credit_ledger"("referralRewardId", "type");

-- CreateIndex
CREATE INDEX "referral_risk_events_referralId_createdAt_idx" ON "referral_risk_events"("referralId", "createdAt");

-- CreateIndex
CREATE INDEX "referral_risk_events_userId_createdAt_idx" ON "referral_risk_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "referral_risk_events_riskStatus_idx" ON "referral_risk_events"("riskStatus");

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_qualifyingOrderId_fkey" FOREIGN KEY ("qualifyingOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "referrals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_credit_accounts" ADD CONSTRAINT "referral_credit_accounts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_credit_ledger" ADD CONSTRAINT "referral_credit_ledger_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "referral_credit_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_credit_ledger" ADD CONSTRAINT "referral_credit_ledger_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_credit_ledger" ADD CONSTRAINT "referral_credit_ledger_referralRewardId_fkey" FOREIGN KEY ("referralRewardId") REFERENCES "referral_rewards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_risk_events" ADD CONSTRAINT "referral_risk_events_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_risk_events" ADD CONSTRAINT "referral_risk_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
