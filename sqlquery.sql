TRUNCATE TABLE "public"."Product" CASCADE

TRUNCATE TABLE "public"."StockReceipt" CASCADE

TRUNCATE TABLE "public"."StockReceiptItem" CASCADE

TRUNCATE TABLE "public"."SalesInvoice" CASCADE



BEGIN;

TRUNCATE TABLE
  "Warehouse","WarehouseContact","Brand","ItemGroup","UomGroup","Uom","TaxCode","HsnSac",
  "Product","PriceList","BatchSerial","ProductLot","SellingPrice","PriceHistory",
  "Customer","Supplier","Employee",
  "HeldBill","HeldBillLine","Promotion","LoyaltyProgram","GiftVoucher",
  "SalesQuotation","SalesQuotationItem","SalesOrder","SalesOrderItem",
  "SalesInvoice","SalesInvoiceItem","SalesReturn","SalesReturnItem",
  "BarcodeLabelBatch","BarcodeLabelItem",
  "StockIndent","StockIndentItem","StockTransfer","StockTransferItem",
  "StockReceipt","StockReceiptItem","StockReturn","StockReturnItem",
  "StockWastage","StockWastageItem","StockCount","StockCountItem",
  "ShiftSession","ShiftOpeningDenomination","ShiftClosingDenomination",
  "CashWithdrawal","CashDeposit","CashTransfer","Expense",
  "Linesales","LinesaleItemDetails","LinesaleOfferDetails",
  "Attachment","AttachmentFile",
  "MasterSync","MasterSyncLine","SAPSync","SAPSyncLine","StockSync","StockSyncLine",
  "Notification","NotificationState"
RESTART IDENTITY CASCADE;

COMMIT;



TRUNCATE TABLE
  "LinesaleOfferDetails",  
  "LinesaleItemDetails",   
  "Linesales",             
  "SalesReturnItem",
  "SalesReturn",            
  "StockReceiptItem",
  "StockReceipt",           
  "Expense"
RESTART IDENTITY CASCADE;