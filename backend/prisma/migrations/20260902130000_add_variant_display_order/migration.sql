ALTER TABLE "product_variants" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "product_variants_productId_displayOrder_idx" ON "product_variants"("productId", "displayOrder");
