import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { env, corsOrigins } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import healthRoutes from './modules/health/health.routes.js';
import outletRoutes from './modules/outlet/outlet.routes.js';
import warehouseRoutes from './modules/warehouse/warehouse.routes.js';
import brandRoutes from './modules/brand/brand.routes.js';
import uomGroupRoutes from './modules/uom/uomGroup.routes.js';
import uomRoutes from './modules/uom/uom.routes.js';
import taxCodeRoutes from './modules/tax-code/taxCode.routes.js';
import hsnSacRoutes from './modules/hsn-sac/hsnSac.routes.js';
import productRoutes from './modules/product/product.routes.js';
import sellingPriceRoutes from './modules/selling-price/sellingPrice.routes.js';
import priceListRoutes from './modules/price-list/priceList.routes.js';
import batchSerialRoutes from './modules/batch-serial/batchSerial.routes.js';
import customerRoutes from './modules/customer/customer.routes.js';
import supplierRoutes from './modules/supplier/supplier.routes.js';
import employeeRoutes from './modules/employee/employee.routes.js';
import saleRoutes from './modules/sale/sale.routes.js';
import heldBillRoutes from './modules/held-bill/heldBill.routes.js';
import promotionRoutes from './modules/promotion/promotion.routes.js';
import giftVoucherRoutes from './modules/gift-voucher/giftVoucher.routes.js';
import loyaltyRoutes from './modules/loyalty/loyalty.routes.js';
import salesQuotationRoutes from './modules/sales-quotation/salesQuotation.routes.js';
import salesReturnRoutes from './modules/sales-return/salesReturn.routes.js';
import salesOrderRoutes from './modules/sales-order/salesOrder.routes.js';
import salesInvoiceRoutes from './modules/sales-invoice/salesInvoice.routes.js';
import barcodeLabelRoutes from './modules/barcode-label/barcodeLabel.routes.js';
import stockIndentRoutes from './modules/stock-indent/stockIndent.routes.js';
import stockTransferRoutes from './modules/stock-transfer/stockTransfer.routes.js';
import stockReceiptRoutes from './modules/stock-receipt/stockReceipt.routes.js';
import stockReturnRoutes from './modules/stock-return/stockReturn.routes.js';
import stockWastageRoutes from './modules/stock-wastage/stockWastage.routes.js';
import stockCountRoutes from './modules/stock-count/stockCount.routes.js';
import shiftSessionRoutes from './modules/shift-session/shiftSession.routes.js';
import cashWithdrawalRoutes from './modules/cash-withdrawal/cashWithdrawal.routes.js';
import cashDepositRoutes from './modules/cash-deposit/cashDeposit.routes.js';
import cashTransferRoutes from './modules/cash-transfer/cashTransfer.routes.js';
import cashDrawerOpeningRoutes from './modules/cash-drawer-opening/cashDrawerOpening.routes.js';
import shiftClosingRoutes from './modules/shift-closing/shiftClosing.routes.js';
import cashReconciliationRoutes from './modules/cash-reconciliation/cashReconciliation.routes.js';
import shortageExcessRoutes from './modules/shortage-excess/shortageExcess.routes.js';
import cashierWiseSalesRoutes from './modules/cashier-wise-sales/cashierWiseSales.routes.js';
import shiftVarianceRoutes from './modules/shift-variance/shiftVariance.routes.js';
import grossProfitRoutes from './modules/gross-profit/grossProfit.routes.js';
import netSalesRoutes from './modules/net-sales/netSales.routes.js';
import productLotRoutes from './modules/product-lot/productLot.routes.js';
import expenseReportRoutes from './modules/expense-report/expenseReport.routes.js';
import financialReportsRoutes from './modules/financial-reports/financialReports.routes.js';
import inventoryReportsRoutes from './modules/inventory-reports/inventoryReports.routes.js';
import cashierReportsRoutes from './modules/cashier-reports/cashierReports.routes.js';
import salesReportsRoutes from './modules/sales-reports/salesReports.routes.js';
import cashierPanelRoutes from './modules/cashier-panel/cashierPanel.routes.js';
import expenseRoutes from './modules/expense/expense.routes.js';
import companyRoutes from './modules/company/company.routes.js';
import roleRoutes from './modules/role/role.routes.js';
import userRoutes from './modules/user/user.routes.js';
import { authorize } from './middleware/authorize.js';

export const app = express();

// Allow any origin listed in CORS_ORIGIN (comma-separated — see
// config/env.js). Using a dynamic origin callback instead of a static
// string/array lets us:
//  - support multiple allowed origins (local dev + the deployed Azure
//    Static Web App, plus any preview URLs) from one env var
//  - allow requests with no Origin header (server-to-server calls, curl,
//    health checks) which browsers don't send an Origin for anyway
//  - support "*" (allow all) via CORS_ORIGIN=* without breaking credentials
const corsOptions = {
  origin(origin, callback) {
    if (!origin || corsOrigins.includes('*') || corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    const err = new Error(`Origin ${origin} is not allowed by CORS`);
    err.statusCode = 403;
    callback(err);
  },
  credentials: true,
};

// Sets standard security headers (X-Content-Type-Options, X-Frame-Options,
// etc). `crossOriginResourcePolicy: false` because this is a pure JSON API
// consumed cross-origin by the frontend's own domain — helmet's default
// same-origin resource policy has no upside here and only risk of blocking
// legitimate cross-origin fetches.
app.use(helmet({ crossOriginResourcePolicy: false }));
// Gzips JSON responses — list endpoints in particular compress very well.
app.use(compression());

app.use(cors(corsOptions));
// Bulk imports (see modules/product's /bulk route) send larger-than-default
// JSON bodies; the frontend already chunks uploads to keep each request
// modest, but the higher limit leaves headroom without opening the door to
// arbitrarily large payloads.
app.use(express.json({ limit: '2mb' }));

// Unauthenticated on purpose — see modules/health. Combines a DB round-trip
// with the fact that reaching this handler already proves the backend is up,
// so the frontend's HealthStatusTag can tell "backend down" apart from
// "backend up, database down" from a single response.
app.use('/api/health', healthRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', authorize('management-dashboard', { lookup: true }), dashboardRoutes);
app.use('/api/outlets', authorize('outlet', { lookup: true, publicRead: true }), outletRoutes);
app.use('/api/warehouses', authorize('warehouse', { lookup: true }), warehouseRoutes);
app.use('/api/masters/brand', authorize('brand', { lookup: true }), brandRoutes);
app.use('/api/masters/uom-groups', authorize('uom', { lookup: true }), uomGroupRoutes);
app.use('/api/masters/uom', authorize('uom', { lookup: true }), uomRoutes);
app.use('/api/masters/tax-code', authorize('tax-code', { lookup: true }), taxCodeRoutes);
app.use('/api/masters/hsn-sac', authorize('hsn-sac', { lookup: true }), hsnSacRoutes);
app.use('/api/masters/product', authorize('product', { lookup: true }), productRoutes);
app.use('/api/masters/selling-price', authorize('selling-price', { lookup: true }), sellingPriceRoutes);
app.use('/api/masters/price-list', authorize('price-list', { lookup: true }), priceListRoutes);
app.use('/api/masters/batch-serial', authorize('batch-serial', { lookup: true }), batchSerialRoutes);
app.use('/api/customers', authorize('customer', { lookup: true }), customerRoutes);
app.use('/api/masters/supplier', authorize('supplier', { lookup: true }), supplierRoutes);
app.use('/api/masters/employee', authorize('employee', { lookup: true }), employeeRoutes);
app.use('/api/sales', authorize('line-sale', { alsoView: ['reports', 'cashier-panel', 'sales-return', 'sales-invoice', 'day-close'] }), saleRoutes);
app.use('/api/held-bills', authorize('line-sale'), heldBillRoutes);
app.use('/api/promotions', authorize('promotion', { lookup: true }), promotionRoutes);
app.use('/api/gift-vouchers', authorize('gift-voucher', { lookup: true }), giftVoucherRoutes);
app.use('/api/loyalty-programs', authorize('loyalty', { lookup: true }), loyaltyRoutes);
app.use('/api/sales-quotations', authorize('sales-quotation', { alsoView: ['reports'] }), salesQuotationRoutes);
app.use('/api/sales-returns', authorize('sales-return', { alsoView: ['reports'] }), salesReturnRoutes);
app.use('/api/sales-orders', authorize('sales-order', { alsoView: ['reports'] }), salesOrderRoutes);
app.use('/api/sales-invoices', authorize('sales-invoice', { alsoView: ['reports'] }), salesInvoiceRoutes);
app.use('/api/barcode-labels', authorize('barcode-label', { lookup: true }), barcodeLabelRoutes);
app.use('/api/stock-indents', authorize('stock-indent', { alsoView: ['reports'] }), stockIndentRoutes);
app.use('/api/stock-transfers', authorize('stock-transfer', { alsoView: ['reports'] }), stockTransferRoutes);
app.use('/api/stock-receipts', authorize('stock-receipt', { lookup: true }), stockReceiptRoutes);
app.use('/api/stock-returns', authorize('stock-return', { alsoView: ['reports'] }), stockReturnRoutes);
app.use('/api/stock-wastages', authorize('stock-wastage', { alsoView: ['reports'] }), stockWastageRoutes);
app.use('/api/stock-counts', authorize('stock-count', { alsoView: ['reports'] }), stockCountRoutes);
app.use('/api/shift-sessions', authorize('cashier-panel', { lookup: true }), shiftSessionRoutes);
app.use('/api/cash-withdrawals', authorize('cashier-panel', { alsoView: ['reports'] }), cashWithdrawalRoutes);
app.use('/api/cash-deposits', authorize('cashier-panel', { alsoView: ['reports'] }), cashDepositRoutes);
app.use('/api/cash-transfers', authorize('cashier-panel', { alsoView: ['reports'] }), cashTransferRoutes);
app.use('/api/cash-drawer-openings', authorize('cashier-panel', { alsoView: ['reports'] }), cashDrawerOpeningRoutes);
app.use('/api/shift-closings', authorize('cashier-panel', { alsoView: ['reports', 'day-close'] }), shiftClosingRoutes);
app.use('/api/cash-reconciliations', authorize('cashier-panel', { alsoView: ['reports'] }), cashReconciliationRoutes);
app.use('/api/shortage-excess', authorize('cashier-panel', { alsoView: ['reports'] }), shortageExcessRoutes);
app.use('/api/reports/inventory', authorize('reports-inventory'), inventoryReportsRoutes);
app.use('/api/reports/cashier', authorize('reports-cashier'), cashierReportsRoutes);
app.use('/api/reports/sales', authorize('reports-sales'), salesReportsRoutes);
app.use('/api/gross-profit', authorize('reports-financial'), grossProfitRoutes);
app.use('/api/net-sales', authorize('reports-financial'), netSalesRoutes);
app.use('/api/expense-report', authorize('reports-financial'), expenseReportRoutes);
app.use('/api/financial-reports', authorize('reports-financial'), financialReportsRoutes);
// Lot / FIFO price lookup used by the Line Sale screen (and read by Reports).
app.use('/api/product-lots', authorize('line-sale', { lookup: true, alsoView: ['reports'] }), productLotRoutes);
app.use('/api/cashier-wise-sales', authorize('cashier-panel', { alsoView: ['reports'] }), cashierWiseSalesRoutes);
app.use('/api/shift-variance', authorize('cashier-panel', { alsoView: ['reports'] }), shiftVarianceRoutes);
app.use('/api/cashier-panel', authorize('cashier-panel', { alsoView: ['reports'] }), cashierPanelRoutes);
app.use('/api/expenses', authorize('expenses-book', { alsoView: ['reports'] }), expenseRoutes);
app.use('/api/roles', authorize('user-management'), roleRoutes);
app.use('/api/users', authorize('user-management'), userRoutes);
app.use('/api/company', authorize('company', { lookup: true, publicRead: true }), companyRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
