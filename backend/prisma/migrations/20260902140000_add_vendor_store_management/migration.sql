ALTER TABLE "vendors" ADD COLUMN "operatingHoursJson" JSONB;
ALTER TABLE "vendors" ADD COLUMN "temporaryClosureUntil" TIMESTAMP(3);
ALTER TABLE "vendors" ADD COLUMN "holidayMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "vendors" ADD COLUMN "busyMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "vendors" ADD COLUMN "busyPreparationTimeMinutes" INTEGER;
ALTER TABLE "vendors" ADD COLUMN "deliveryRadiusKm" DECIMAL(6,2);
ALTER TABLE "vendors" ADD COLUMN "minimumOrderAmount" INTEGER;
ALTER TABLE "vendors" ADD COLUMN "averagePreparationTimeMinutes" INTEGER;
