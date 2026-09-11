ALTER TABLE "vendors" ADD COLUMN "maxOrdersPerHour" INTEGER;
ALTER TABLE "products" ADD COLUMN "availabilityStartTime" TEXT;
ALTER TABLE "products" ADD COLUMN "availabilityEndTime" TEXT;
ALTER TABLE "products" ADD COLUMN "availabilityDays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

CREATE TABLE "vendor_menu_schedules" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "days" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vendor_menu_schedules_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "vendor_menu_schedule_items" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "vendor_menu_schedule_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vendor_menu_schedules_vendorId_name_key" ON "vendor_menu_schedules"("vendorId","name");
CREATE INDEX "vendor_menu_schedules_vendorId_isActive_idx" ON "vendor_menu_schedules"("vendorId","isActive");
CREATE UNIQUE INDEX "vendor_menu_schedule_items_scheduleId_productId_key" ON "vendor_menu_schedule_items"("scheduleId","productId");
CREATE INDEX "vendor_menu_schedule_items_scheduleId_displayOrder_idx" ON "vendor_menu_schedule_items"("scheduleId","displayOrder");
ALTER TABLE "vendor_menu_schedules" ADD CONSTRAINT "vendor_menu_schedules_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vendor_menu_schedule_items" ADD CONSTRAINT "vendor_menu_schedule_items_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "vendor_menu_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vendor_menu_schedule_items" ADD CONSTRAINT "vendor_menu_schedule_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
