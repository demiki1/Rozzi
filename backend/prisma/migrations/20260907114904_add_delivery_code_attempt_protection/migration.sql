-- DropForeignKey
ALTER TABLE "rider_payouts" DROP CONSTRAINT "rider_payouts_ledgerEntryId_fkey";

-- DropForeignKey
ALTER TABLE "wallet_transactions" DROP CONSTRAINT "wallet_transactions_customerId_fkey";

-- DropIndex
DROP INDEX "addresses_customerId_idx";

-- DropIndex
DROP INDEX "cart_items_cartId_productId_variantId_key";

-- DropIndex
DROP INDEX "notifications_userId_idx";

-- DropIndex
DROP INDEX "payments_providerTransactionId_idx";

-- DropIndex
DROP INDEX "promotions_isActive_startsAt_endsAt_idx";

-- DropIndex
DROP INDEX "reviews_vendorId_createdAt_idx";

-- DropIndex
DROP INDEX "reviews_vendorId_vendorRating_idx";

-- DropIndex
DROP INDEX "wallet_withdrawals_walletId_status_idx";

-- AlterTable
ALTER TABLE "addresses" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "vendor_verifications" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "promotion_redemptions_orderId_idx" ON "promotion_redemptions"("orderId");

-- CreateIndex
CREATE INDEX "wallet_withdrawals_status_idx" ON "wallet_withdrawals"("status");

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_withdrawals" ADD CONSTRAINT "wallet_withdrawals_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "vendor_advertising_campaigns_vendorId_status_startsAt_endsAt_id" RENAME TO "vendor_advertising_campaigns_vendorId_status_startsAt_endsA_idx";
