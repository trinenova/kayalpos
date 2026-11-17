-- AlterTable
ALTER TABLE "SalesReturn" ADD COLUMN     "BalanceAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "ExchangeGrandTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "ExchangeSubTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "ExchangeTaxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "ReturnType" TEXT NOT NULL DEFAULT 'return',
ADD COLUMN     "SettlementMode" TEXT,
ALTER COLUMN "RefundMode" DROP NOT NULL;

-- CreateTable
CREATE TABLE "SalesReturnExchangeItem" (
    "Id" TEXT NOT NULL,
    "ReturnId" TEXT NOT NULL,
    "ProductId" TEXT NOT NULL,
    "Code" TEXT NOT NULL,
    "Name" TEXT NOT NULL,
    "Uom" TEXT NOT NULL,
    "Qty" DECIMAL(12,3) NOT NULL,
    "Rate" DECIMAL(12,2) NOT NULL,
    "TaxRate" DECIMAL(5,4) NOT NULL,
    "Amount" DECIMAL(12,2) NOT NULL,
    "LotId" TEXT,
    "UnitCost" DECIMAL(19,6),

    CONSTRAINT "SalesReturnExchangeItem_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE INDEX "SalesReturnExchangeItem_ReturnId_idx" ON "SalesReturnExchangeItem"("ReturnId");

-- CreateIndex
CREATE INDEX "SalesReturnExchangeItem_ProductId_idx" ON "SalesReturnExchangeItem"("ProductId");

-- AddForeignKey
ALTER TABLE "SalesReturnExchangeItem" ADD CONSTRAINT "SalesReturnExchangeItem_ReturnId_fkey" FOREIGN KEY ("ReturnId") REFERENCES "SalesReturn"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturnExchangeItem" ADD CONSTRAINT "SalesReturnExchangeItem_ProductId_fkey" FOREIGN KEY ("ProductId") REFERENCES "Product"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturnExchangeItem" ADD CONSTRAINT "SalesReturnExchangeItem_LotId_fkey" FOREIGN KEY ("LotId") REFERENCES "ProductLot"("Id") ON DELETE SET NULL ON UPDATE CASCADE;
