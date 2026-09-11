CREATE TYPE "SurgeLevel" AS ENUM (
  'NORMAL',
  'SLIGHTLY_HIGH',
  'HIGH',
  'VERY_HIGH'
);

CREATE TABLE "pricing_configs" (
  "id" TEXT NOT NULL,
  "serviceAreaId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "serviceFeeRatePercent" DECIMAL(5,2) NOT NULL,
  "serviceFeeCapAmount" INTEGER NOT NULL,
  "baseDeliveryFee" INTEGER NOT NULL,
  "perKmDeliveryFee" INTEGER NOT NULL,
  "deliveryRadiusKm" DECIMAL(6,2) NOT NULL,
  "surgeEnabled" BOOLEAN NOT NULL DEFAULT true,
  "surgeLevel" "SurgeLevel" NOT NULL DEFAULT 'NORMAL',
  "surgeSlightlyHighAmount" INTEGER NOT NULL DEFAULT 0,
  "surgeHighAmount" INTEGER NOT NULL DEFAULT 0,
  "surgeVeryHighAmount" INTEGER NOT NULL DEFAULT 0,
  "surgeMaxAmount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "pricing_configs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "orders"
ADD COLUMN "surgeFeeAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "pricingConfigId" TEXT;

CREATE INDEX "pricing_configs_serviceAreaId_idx"
ON "pricing_configs"("serviceAreaId");

CREATE INDEX "pricing_configs_serviceAreaId_isActive_idx"
ON "pricing_configs"("serviceAreaId", "isActive");

CREATE UNIQUE INDEX "pricing_configs_one_active_per_service_area_idx"
ON "pricing_configs"("serviceAreaId")
WHERE "isActive" = true;

ALTER TABLE "pricing_configs"
ADD CONSTRAINT "pricing_configs_serviceAreaId_fkey"
FOREIGN KEY ("serviceAreaId")
REFERENCES "service_areas"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "orders"
ADD CONSTRAINT "orders_pricingConfigId_fkey"
FOREIGN KEY ("pricingConfigId")
REFERENCES "pricing_configs"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
