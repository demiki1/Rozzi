CREATE TABLE "rider_issues" (
  "id" TEXT NOT NULL,
  "riderId" TEXT NOT NULL,
  "deliveryId" TEXT,
  "category" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rider_issues_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "rider_issues_riderId_status_idx" ON "rider_issues"("riderId", "status");
CREATE INDEX "rider_issues_deliveryId_idx" ON "rider_issues"("deliveryId");
ALTER TABLE "rider_issues" ADD CONSTRAINT "rider_issues_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rider_issues" ADD CONSTRAINT "rider_issues_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
