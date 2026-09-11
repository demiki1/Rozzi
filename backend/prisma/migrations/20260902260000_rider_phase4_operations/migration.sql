CREATE TYPE "RiderShiftStatus" AS ENUM ('BOOKED','CHECKED_IN','COMPLETED','CANCELLED','MISSED');
CREATE TABLE "rider_shifts" (
  "id" TEXT NOT NULL, "riderId" TEXT NOT NULL, "serviceAreaId" TEXT, "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL, "status" "RiderShiftStatus" NOT NULL DEFAULT 'BOOKED', "checkedInAt" TIMESTAMP(3), "checkedOutAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rider_shifts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "rider_shifts_riderId_startsAt_idx" ON "rider_shifts"("riderId","startsAt");
CREATE INDEX "rider_shifts_serviceAreaId_startsAt_idx" ON "rider_shifts"("serviceAreaId","startsAt");
CREATE INDEX "rider_shifts_status_startsAt_idx" ON "rider_shifts"("status","startsAt");
ALTER TABLE "rider_shifts" ADD CONSTRAINT "rider_shifts_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rider_shifts" ADD CONSTRAINT "rider_shifts_serviceAreaId_fkey" FOREIGN KEY ("serviceAreaId") REFERENCES "service_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
