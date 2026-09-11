CREATE TABLE "favorite_vendors" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "favorite_vendors_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "favorite_vendors_customerId_vendorId_key" ON "favorite_vendors"("customerId","vendorId");
CREATE INDEX "favorite_vendors_customerId_createdAt_idx" ON "favorite_vendors"("customerId","createdAt");
CREATE INDEX "favorite_vendors_vendorId_idx" ON "favorite_vendors"("vendorId");
ALTER TABLE "favorite_vendors" ADD CONSTRAINT "favorite_vendors_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "favorite_vendors" ADD CONSTRAINT "favorite_vendors_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "favorite_products" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "favorite_products_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "favorite_products_customerId_productId_key" ON "favorite_products"("customerId","productId");
CREATE INDEX "favorite_products_customerId_createdAt_idx" ON "favorite_products"("customerId","createdAt");
CREATE INDEX "favorite_products_productId_idx" ON "favorite_products"("productId");
ALTER TABLE "favorite_products" ADD CONSTRAINT "favorite_products_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "favorite_products" ADD CONSTRAINT "favorite_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reviews" ADD COLUMN "title" TEXT;
ALTER TABLE "reviews" ADD COLUMN "photoUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
