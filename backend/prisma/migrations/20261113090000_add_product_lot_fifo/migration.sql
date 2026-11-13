-- FIFO purchase lots: one row per receipt line / opening stock, each with its own
-- MRP, purchase price and selling price.
CREATE TABLE "ProductLot" (
    "Id" TEXT NOT NULL,
    "TenantId" TEXT NOT NULL,
    "ProductId" TEXT NOT NULL,
    "LotNo" TEXT NOT NULL,
    "Source" TEXT NOT NULL DEFAULT 'RECEIPT',
    "SourceRef" TEXT,
    "ReceivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Mrp" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "PurchasePrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "SellingPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "QtyReceived" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "QtyRemaining" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "ExpiryDate" TIMESTAMP(3),
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductLot_pkey" PRIMARY KEY ("Id")
);

CREATE INDEX "ProductLot_TenantId_ProductId_ReceivedAt_idx" ON "ProductLot"("TenantId", "ProductId", "ReceivedAt");
CREATE INDEX "ProductLot_ProductId_QtyRemaining_idx" ON "ProductLot"("ProductId", "QtyRemaining");

ALTER TABLE "ProductLot" ADD CONSTRAINT "ProductLot_TenantId_fkey" FOREIGN KEY ("TenantId") REFERENCES "Tenant"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductLot" ADD CONSTRAINT "ProductLot_ProductId_fkey" FOREIGN KEY ("ProductId") REFERENCES "Product"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sale lines remember the lot they were sold from and that lot's purchase price.
ALTER TABLE "LinesaleItemDetails" ADD COLUMN "LotId" TEXT, ADD COLUMN "UnitCost" DECIMAL(19,6);
ALTER TABLE "LinesaleItemDetails" ADD CONSTRAINT "LinesaleItemDetails_LotId_fkey" FOREIGN KEY ("LotId") REFERENCES "ProductLot"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Optional selling-side prices on a stock receipt line (default to the product's).
ALTER TABLE "StockReceiptItem" ADD COLUMN "Mrp" DECIMAL(12,2), ADD COLUMN "SellingPrice" DECIMAL(12,2);

-- Opening lot for every product that already has stock, so FIFO has something to
-- sell from: cost = latest Selling Price purchase cost (0 if none), prices = the
-- product's current MRP / sale price.
INSERT INTO "ProductLot" ("Id", "TenantId", "ProductId", "LotNo", "Source", "ReceivedAt", "Mrp", "PurchasePrice", "SellingPrice", "QtyReceived", "QtyRemaining", "UpdatedAt")
SELECT gen_random_uuid()::text, p."TenantId", p."Id", 'OPENING', 'OPENING', p."CreatedAt", p."MRP",
       COALESCE((SELECT sp."PurchaseCost" FROM "SellingPrice" sp WHERE sp."ProductId" = p."Id" ORDER BY sp."UpdatedAt" DESC LIMIT 1), 0),
       p."SalePrice", p."AvailableQty", p."AvailableQty", CURRENT_TIMESTAMP
FROM "Product" p
WHERE p."AvailableQty" > 0;
