CREATE TABLE "outlets" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "deliveryRadiusKm" DECIMAL(6,2),
  "minimumOrderAmount" INTEGER,
  "averagePreparationTimeMinutes" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isOpen" BOOLEAN NOT NULL DEFAULT false,
  "operatingHoursJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "outlets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "outlets_vendorId_name_key" ON "outlets"("vendorId","name");
CREATE INDEX "outlets_vendorId_isActive_idx" ON "outlets"("vendorId","isActive");
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "outlet_hours" (
  "id" TEXT NOT NULL,
  "outletId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "openTime" TEXT,
  "closeTime" TEXT,
  "isClosed" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "outlet_hours_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "outlet_hours_outletId_dayOfWeek_key" ON "outlet_hours"("outletId","dayOfWeek");
ALTER TABLE "outlet_hours" ADD CONSTRAINT "outlet_hours_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "outlet_products" (
  "outletId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "outlet_products_pkey" PRIMARY KEY ("outletId","productId")
);
CREATE INDEX "outlet_products_productId_idx" ON "outlet_products"("productId");
ALTER TABLE "outlet_products" ADD CONSTRAINT "outlet_products_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outlet_products" ADD CONSTRAINT "outlet_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
