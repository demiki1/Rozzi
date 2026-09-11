ALTER TABLE "inventory" ADD COLUMN "lowStockThreshold" INTEGER NOT NULL DEFAULT 10;

CREATE TABLE "stock_movements" (
  "id" TEXT NOT NULL,
  "inventoryId" TEXT NOT NULL,
  "quantityDelta" INTEGER NOT NULL,
  "quantityBefore" INTEGER NOT NULL,
  "quantityAfter" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_movements_inventoryId_createdAt_idx" ON "stock_movements"("inventoryId", "createdAt");
CREATE INDEX "stock_movements_actorId_createdAt_idx" ON "stock_movements"("actorId", "createdAt");
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
