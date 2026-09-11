ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "marketingNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "orderNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "promotionalNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "addresses_customerId_isDefault_idx" ON "addresses"("customerId","isDefault");
