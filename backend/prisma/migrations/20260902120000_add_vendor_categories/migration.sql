CREATE TABLE "vendor_categories" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "imageUrl" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "availabilityStartTime" TEXT,
  "availabilityEndTime" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vendor_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vendor_categories_vendorId_name_key" ON "vendor_categories"("vendorId", "name");
CREATE INDEX "vendor_categories_vendorId_displayOrder_idx" ON "vendor_categories"("vendorId", "displayOrder");
ALTER TABLE "vendor_categories" ADD CONSTRAINT "vendor_categories_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "products" ADD COLUMN "vendorCategoryId" TEXT;
CREATE INDEX "products_vendorCategoryId_idx" ON "products"("vendorCategoryId");
ALTER TABLE "products" ADD CONSTRAINT "products_vendorCategoryId_fkey" FOREIGN KEY ("vendorCategoryId") REFERENCES "vendor_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
