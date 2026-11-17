-- Append-only log of every barcode actually generated for print — see the
-- BarcodeGenerationLog model comment in schema.prisma. BatchId is nullable
-- (SET NULL on delete) so deleting a batch later never erases the history
-- of what was already generated and printed from it.
CREATE TABLE "BarcodeGenerationLog" (
    "Id" TEXT NOT NULL,
    "TenantId" TEXT NOT NULL,
    "BatchId" TEXT,
    "BatchCode" TEXT NOT NULL,
    "ItemCode" TEXT NOT NULL,
    "ItemName" TEXT NOT NULL,
    "BarcodeValue" TEXT NOT NULL,
    "BarcodeType" TEXT NOT NULL,
    "PrintQty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "GeneratedBy" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BarcodeGenerationLog_pkey" PRIMARY KEY ("Id")
);

CREATE INDEX "BarcodeGenerationLog_TenantId_CreatedAt_idx" ON "BarcodeGenerationLog"("TenantId", "CreatedAt");
CREATE INDEX "BarcodeGenerationLog_TenantId_ItemCode_idx" ON "BarcodeGenerationLog"("TenantId", "ItemCode");
CREATE INDEX "BarcodeGenerationLog_BatchId_idx" ON "BarcodeGenerationLog"("BatchId");

ALTER TABLE "BarcodeGenerationLog" ADD CONSTRAINT "BarcodeGenerationLog_TenantId_fkey" FOREIGN KEY ("TenantId") REFERENCES "Tenant"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BarcodeGenerationLog" ADD CONSTRAINT "BarcodeGenerationLog_BatchId_fkey" FOREIGN KEY ("BatchId") REFERENCES "BarcodeLabelBatch"("Id") ON DELETE SET NULL ON UPDATE CASCADE;
