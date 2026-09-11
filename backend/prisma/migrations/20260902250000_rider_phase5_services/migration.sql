ALTER TABLE "rider_documents" ADD COLUMN "expiryDate" TIMESTAMP(3);

CREATE TYPE "RiderInsuranceStatus" AS ENUM ('ACTIVE','EXPIRED','PENDING','CANCELLED');
CREATE TABLE "rider_insurances" (
  "id" TEXT NOT NULL, "riderId" TEXT NOT NULL, "provider" TEXT NOT NULL, "policyNumber" TEXT NOT NULL,
  "coverageType" TEXT NOT NULL, "startDate" TIMESTAMP(3) NOT NULL, "expiryDate" TIMESTAMP(3) NOT NULL,
  "documentUrl" TEXT, "status" "RiderInsuranceStatus" NOT NULL DEFAULT 'PENDING', "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rider_insurances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rider_insurances_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "rider_insurances_riderId_policyNumber_key" ON "rider_insurances"("riderId","policyNumber");
CREATE INDEX "rider_insurances_riderId_expiryDate_idx" ON "rider_insurances"("riderId","expiryDate");
CREATE INDEX "rider_insurances_status_expiryDate_idx" ON "rider_insurances"("status","expiryDate");

CREATE TYPE "RiderMaintenanceType" AS ENUM ('SERVICE','OIL_CHANGE','TYRE','BRAKE','REPAIR','INSPECTION','OTHER');
CREATE TABLE "rider_vehicle_maintenance" (
  "id" TEXT NOT NULL, "riderId" TEXT NOT NULL, "type" "RiderMaintenanceType" NOT NULL, "description" TEXT NOT NULL,
  "odometerKm" INTEGER, "costAmount" INTEGER, "serviceDate" TIMESTAMP(3) NOT NULL, "nextDueDate" TIMESTAMP(3),
  "nextDueKm" INTEGER, "receiptUrl" TEXT, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rider_vehicle_maintenance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rider_vehicle_maintenance_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "rider_vehicle_maintenance_riderId_serviceDate_idx" ON "rider_vehicle_maintenance"("riderId","serviceDate");
CREATE INDEX "rider_vehicle_maintenance_riderId_nextDueDate_idx" ON "rider_vehicle_maintenance"("riderId","nextDueDate");

CREATE TYPE "RiderEquipmentStatus" AS ENUM ('REQUESTED','ISSUED','RETURNED','DAMAGED','LOST','REPLACEMENT_REQUESTED');
CREATE TABLE "rider_equipment" (
  "id" TEXT NOT NULL, "riderId" TEXT NOT NULL, "itemType" TEXT NOT NULL, "serialNumber" TEXT,
  "status" "RiderEquipmentStatus" NOT NULL DEFAULT 'REQUESTED', "issuedAt" TIMESTAMP(3), "returnedAt" TIMESTAMP(3),
  "replacementRequestedAt" TIMESTAMP(3), "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rider_equipment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rider_equipment_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "rider_equipment_riderId_status_idx" ON "rider_equipment"("riderId","status");

CREATE TYPE "RiderAcademyProgressStatus" AS ENUM ('NOT_STARTED','IN_PROGRESS','COMPLETED');
CREATE TABLE "rider_academy_progress" (
  "id" TEXT NOT NULL, "riderId" TEXT NOT NULL, "code" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT NOT NULL,
  "status" "RiderAcademyProgressStatus" NOT NULL DEFAULT 'NOT_STARTED', "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "scorePercent" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rider_academy_progress_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rider_academy_progress_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "rider_academy_progress_riderId_code_key" ON "rider_academy_progress"("riderId","code");
CREATE INDEX "rider_academy_progress_riderId_status_idx" ON "rider_academy_progress"("riderId","status");

CREATE TABLE "rider_sos_events" (
  "id" TEXT NOT NULL, "riderId" TEXT NOT NULL, "deliveryId" TEXT, "latitude" DECIMAL(10,7), "longitude" DECIMAL(10,7),
  "status" TEXT NOT NULL DEFAULT 'OPEN', "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "resolvedAt" TIMESTAMP(3), "notes" TEXT,
  CONSTRAINT "rider_sos_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rider_sos_events_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "rider_sos_events_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "rider_sos_events_riderId_triggeredAt_idx" ON "rider_sos_events"("riderId","triggeredAt");
CREATE INDEX "rider_sos_events_status_triggeredAt_idx" ON "rider_sos_events"("status","triggeredAt");
