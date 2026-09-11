CREATE TYPE "VendorStaffRole" AS ENUM ('OWNER', 'MANAGER', 'CASHIER', 'KITCHEN', 'INVENTORY_MANAGER');

CREATE TABLE "vendor_staff_members" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "VendorStaffRole" NOT NULL DEFAULT 'MANAGER',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vendor_staff_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vendor_staff_members_vendorId_userId_key" ON "vendor_staff_members"("vendorId","userId");
CREATE INDEX "vendor_staff_members_vendorId_role_isActive_idx" ON "vendor_staff_members"("vendorId","role","isActive");
CREATE INDEX "vendor_staff_members_userId_isActive_idx" ON "vendor_staff_members"("userId","isActive");
ALTER TABLE "vendor_staff_members" ADD CONSTRAINT "vendor_staff_members_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vendor_staff_members" ADD CONSTRAINT "vendor_staff_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "vendor_staff_invitations" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "role" "VendorStaffRole" NOT NULL DEFAULT 'MANAGER',
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vendor_staff_invitations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vendor_staff_invitations_tokenHash_key" ON "vendor_staff_invitations"("tokenHash");
CREATE INDEX "vendor_staff_invitations_vendorId_createdAt_idx" ON "vendor_staff_invitations"("vendorId","createdAt");
CREATE INDEX "vendor_staff_invitations_expiresAt_acceptedAt_idx" ON "vendor_staff_invitations"("expiresAt","acceptedAt");
ALTER TABLE "vendor_staff_invitations" ADD CONSTRAINT "vendor_staff_invitations_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
