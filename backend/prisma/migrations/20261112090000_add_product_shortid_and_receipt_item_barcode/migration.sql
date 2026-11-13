-- Product.ShortId: optional short, human-typable alias, unique per tenant.
-- Existing rows stay NULL (Postgres treats NULLs as distinct, so the unique
-- index does not collide on them).
ALTER TABLE "Product" ADD COLUMN "ShortId" TEXT;
CREATE UNIQUE INDEX "Product_TenantId_ShortId_key" ON "Product"("TenantId", "ShortId");

-- StockReceiptItem.Barcode: barcode captured per receipt line.
ALTER TABLE "StockReceiptItem" ADD COLUMN "Barcode" TEXT;
