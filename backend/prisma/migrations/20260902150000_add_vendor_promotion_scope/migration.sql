ALTER TABLE "promotions" ADD COLUMN "vendorId" TEXT;
CREATE INDEX "promotions_vendorId_isActive_startsAt_endsAt_idx" ON "promotions"("vendorId", "isActive", "startsAt", "endsAt");
CREATE INDEX "promotions_code_idx" ON "promotions"("code");
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
