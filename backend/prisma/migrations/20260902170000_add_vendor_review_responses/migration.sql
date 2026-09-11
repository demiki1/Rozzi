ALTER TABLE "reviews" ADD COLUMN "vendorResponse" TEXT;
ALTER TABLE "reviews" ADD COLUMN "vendorRespondedAt" TIMESTAMP(3);
CREATE INDEX "reviews_vendorId_vendorRating_idx" ON "reviews"("vendorId", "vendorRating");
CREATE INDEX "reviews_vendorId_createdAt_idx" ON "reviews"("vendorId", "createdAt");
