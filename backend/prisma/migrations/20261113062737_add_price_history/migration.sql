-- CreateTable
CREATE TABLE "PriceHistory" (
    "Id" TEXT NOT NULL,
    "TenantId" TEXT NOT NULL,
    "ProductId" TEXT NOT NULL,
    "PreviousPrice" DECIMAL(12,2) NOT NULL,
    "NewPrice" DECIMAL(12,2) NOT NULL,
    "Remarks" TEXT,
    "ChangedBy" TEXT,
    "ChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE INDEX "PriceHistory_TenantId_ProductId_ChangedAt_idx" ON "PriceHistory"("TenantId", "ProductId", "ChangedAt");

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_TenantId_fkey" FOREIGN KEY ("TenantId") REFERENCES "Tenant"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_ProductId_fkey" FOREIGN KEY ("ProductId") REFERENCES "Product"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
