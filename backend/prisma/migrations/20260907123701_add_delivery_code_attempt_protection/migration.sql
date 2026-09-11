-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "deliveryCodeFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryCodeLockedUntil" TIMESTAMP(3);
