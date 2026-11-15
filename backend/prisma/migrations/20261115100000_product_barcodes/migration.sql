-- Multiple barcodes per product, each with its own Sales Price / MRP / UOM
-- (Masters > Product > Barcodes tab). Line Sale bills a scanned barcode at that
-- barcode's price and UOM; everything else uses the product's Sales tab price.

CREATE TABLE "ProductBarcode" (
    "Id" TEXT NOT NULL,
    "TenantId" TEXT NOT NULL,
    "ProductId" TEXT NOT NULL,
    "Barcode" TEXT NOT NULL,
    "SalePrice" DECIMAL(12,2),
    "Mrp" DECIMAL(12,2),
    "Uom" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductBarcode_pkey" PRIMARY KEY ("Id")
);

CREATE UNIQUE INDEX "ProductBarcode_TenantId_Barcode_key" ON "ProductBarcode"("TenantId", "Barcode");
CREATE INDEX "ProductBarcode_ProductId_idx" ON "ProductBarcode"("ProductId");

ALTER TABLE "ProductBarcode" ADD CONSTRAINT "ProductBarcode_ProductId_fkey" FOREIGN KEY ("ProductId") REFERENCES "Product"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Held bills remember which priced barcode a line was scanned with.
ALTER TABLE "HeldBillLine" ADD COLUMN "Barcode" TEXT;
