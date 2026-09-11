CREATE TYPE "VendorVerificationStatus" AS ENUM ('NOT_STARTED','IN_PROGRESS','SUBMITTED','UNDER_REVIEW','NEEDS_INFORMATION','APPROVED','REJECTED');
CREATE TYPE "VendorDocumentStatus" AS ENUM ('PENDING','UNDER_REVIEW','APPROVED','REJECTED');
ALTER TABLE "vendor_documents" ADD COLUMN "status" "VendorDocumentStatus" NOT NULL DEFAULT 'PENDING', ADD COLUMN "rejectionReason" TEXT, ADD COLUMN "reviewedAt" TIMESTAMP(3), ADD COLUMN "reviewedById" TEXT;
CREATE INDEX "vendor_documents_vendorId_status_idx" ON "vendor_documents"("vendorId","status");
CREATE INDEX "vendor_documents_vendorId_docType_idx" ON "vendor_documents"("vendorId","docType");
CREATE TABLE "vendor_verifications" ("id" TEXT NOT NULL,"vendorId" TEXT NOT NULL,"status" "VendorVerificationStatus" NOT NULL DEFAULT 'NOT_STARTED',"submittedAt" TIMESTAMP(3),"reviewedAt" TIMESTAMP(3),"reviewedById" TEXT,"rejectionReason" TEXT,"adminNote" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "vendor_verifications_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "vendor_verifications_vendorId_key" ON "vendor_verifications"("vendorId");
CREATE INDEX "vendor_verifications_status_updatedAt_idx" ON "vendor_verifications"("status","updatedAt");
ALTER TABLE "vendor_verifications" ADD CONSTRAINT "vendor_verifications_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
