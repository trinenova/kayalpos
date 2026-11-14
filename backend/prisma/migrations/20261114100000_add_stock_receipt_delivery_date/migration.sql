-- Stock Receipt: optional Delivery Date (shown under Other Details).
ALTER TABLE "StockReceipt" ADD COLUMN "DeliveryDate" TIMESTAMP(3);
