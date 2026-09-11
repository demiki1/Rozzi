ALTER TABLE "support_tickets" ALTER COLUMN "customerId" DROP NOT NULL;
ALTER TABLE "support_tickets" ADD COLUMN "vendorId" TEXT;
CREATE INDEX "support_tickets_vendorId_status_idx" ON "support_tickets"("vendorId", "status");
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
