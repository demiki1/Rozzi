-- Structured product configurations in cart/order snapshots.
ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "cart_items_cartId_productId_variantId_key";
ALTER TABLE "cart_items" ADD COLUMN IF NOT EXISTS "configurationKey" TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS "cart_items_cartId_productId_configurationKey_key"
  ON "cart_items" ("cartId", "productId", "configurationKey");
CREATE INDEX IF NOT EXISTS "cart_items_cartId_idx" ON "cart_items" ("cartId");

CREATE TABLE IF NOT EXISTS "cart_item_options" (
  "id" TEXT NOT NULL,
  "cartItemId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "optionItemId" TEXT NOT NULL,
  "groupNameSnapshot" TEXT NOT NULL,
  "optionNameSnapshot" TEXT NOT NULL,
  "additionalPriceSnapshot" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cart_item_options_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "cart_item_options_cartItemId_optionItemId_key"
  ON "cart_item_options" ("cartItemId", "optionItemId");
CREATE INDEX IF NOT EXISTS "cart_item_options_cartItemId_idx" ON "cart_item_options" ("cartItemId");
CREATE INDEX IF NOT EXISTS "cart_item_options_optionItemId_idx" ON "cart_item_options" ("optionItemId");
ALTER TABLE "cart_item_options" ADD CONSTRAINT "cart_item_options_cartItemId_fkey"
  FOREIGN KEY ("cartItemId") REFERENCES "cart_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cart_item_options" ADD CONSTRAINT "cart_item_options_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "product_option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cart_item_options" ADD CONSTRAINT "cart_item_options_optionItemId_fkey"
  FOREIGN KEY ("optionItemId") REFERENCES "product_option_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "order_item_options" (
  "id" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "groupNameSnapshot" TEXT NOT NULL,
  "optionNameSnapshot" TEXT NOT NULL,
  "additionalPriceSnapshot" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_item_options_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "order_item_options_orderItemId_idx" ON "order_item_options" ("orderItemId");
ALTER TABLE "order_item_options" ADD CONSTRAINT "order_item_options_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
