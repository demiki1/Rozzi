ALTER TABLE "pricing_configs" ADD COLUMN "riderPayoutRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 92.00;
ALTER TABLE "orders" ADD COLUMN "riderPayoutRateSnapshot" DECIMAL(5,2);
