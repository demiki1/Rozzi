-- 1. Global commission configuration
CREATE TABLE "commission_configs" (
  "id" TEXT NOT NULL,
  "defaultRatePercent" DECIMAL(5,2) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "commission_configs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "commission_configs_isActive_idx"
ON "commission_configs"("isActive");

-- 2. Category-level commission overrides
CREATE TABLE "category_commissions" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "ratePercent" DECIMAL(5,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "category_commissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "category_commissions_categoryId_key"
ON "category_commissions"("categoryId");

CREATE INDEX "category_commissions_categoryId_idx"
ON "category_commissions"("categoryId");

ALTER TABLE "category_commissions"
ADD CONSTRAINT "category_commissions_categoryId_fkey"
FOREIGN KEY ("categoryId")
REFERENCES "categories"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- 3. Vendor-wide commission overrides
CREATE TABLE "vendor_commissions" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "ratePercent" DECIMAL(5,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "vendor_commissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vendor_commissions_vendorId_key"
ON "vendor_commissions"("vendorId");

CREATE INDEX "vendor_commissions_vendorId_idx"
ON "vendor_commissions"("vendorId");

ALTER TABLE "vendor_commissions"
ADD CONSTRAINT "vendor_commissions_vendorId_fkey"
FOREIGN KEY ("vendorId")
REFERENCES "vendors"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- 4. Vendor + category commission overrides
CREATE TABLE "vendor_category_commissions" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "ratePercent" DECIMAL(5,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "vendor_category_commissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vendor_category_commissions_vendorId_categoryId_key"
ON "vendor_category_commissions"("vendorId", "categoryId");

CREATE INDEX "vendor_category_commissions_categoryId_idx"
ON "vendor_category_commissions"("categoryId");

ALTER TABLE "vendor_category_commissions"
ADD CONSTRAINT "vendor_category_commissions_vendorId_fkey"
FOREIGN KEY ("vendorId")
REFERENCES "vendors"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "vendor_category_commissions"
ADD CONSTRAINT "vendor_category_commissions_categoryId_fkey"
FOREIGN KEY ("categoryId")
REFERENCES "categories"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- 5. Add item-level commission snapshot columns temporarily nullable
ALTER TABLE "order_items"
ADD COLUMN "commissionRateSnapshot" DECIMAL(5,2),
ADD COLUMN "commissionAmountSnapshot" INTEGER;

-- 6. Preserve the existing historical vendor commission rate
INSERT INTO "vendor_commissions" ("id", "vendorId", "ratePercent")
SELECT
  gen_random_uuid()::text,
  "id",
  "commissionRate"
FROM "vendors";

-- 7. Create the new global default configuration
INSERT INTO "commission_configs"
  ("id", "defaultRatePercent")
VALUES
  (gen_random_uuid()::text, 8.00);

-- 8. Backfill existing order-item commission snapshots.
-- Historical item commission is based on the item's existing subtotal
-- and the commission rate already snapshotted on its order.
UPDATE "order_items" oi
SET
  "commissionRateSnapshot" = o."commissionRateSnapshot",
  "commissionAmountSnapshot" =
    ROUND(
      oi."subtotalAmount" * o."commissionRateSnapshot" / 100
    )::INTEGER
FROM "orders" o
WHERE oi."orderId" = o."id";

-- 9. Make the item-level snapshots required
ALTER TABLE "order_items"
ALTER COLUMN "commissionRateSnapshot" SET NOT NULL,
ALTER COLUMN "commissionAmountSnapshot" SET NOT NULL;

-- 10. Change the Vendor column default for NEW vendors to 8%.
-- Existing vendor rows remain unchanged.
ALTER TABLE "vendors"
ALTER COLUMN "commissionRate" SET DEFAULT 8.00;