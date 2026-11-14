import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import {
  createSaleSchema, cashSalesQuerySchema, cardSalesQuerySchema, upiSalesQuerySchema, otherPaymentsQuerySchema,
} from './sale.schema.js';
import {
  createSale, nextBillNo, getDiscountSummary, getRecentSales, getSaleByBillNo,
  getSalesOverviewSummary, getCustomerPurchaseSummaries, getCustomerPurchaseSummary,
  getCashSalesReport, getCardSalesReport, getUpiSalesReport, getOtherPaymentsReport,
} from './sale.service.js';

const router = Router();
router.use(requireAuth);

// Live "LS-00001"-style preview for the Line Sale screen's Bill No. field,
// same idea as customer/product's next-code preview.
router.get('/next-bill-no', async (req, res, next) => {
  try {
    const billNo = await nextBillNo(req.user.tenantId);
    res.json({ success: true, data: { billNo } });
  } catch (err) {
    next(err);
  }
});

// Line Sale "Recent Sales" popup — the outlet's last 10 bills.
router.get('/recent', async (req, res, next) => {
  try {
    const data = await getRecentSales(req.user.tenantId, req.user.outletId, 10);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// Full bill for "Recent Sales" View / Print.
router.get('/bill/:billNo', async (req, res, next) => {
  try {
    const data = await getSaleByBillNo(req.user.tenantId, req.user.outletId, req.params.billNo);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// Feeds the Promotion page's "Discount Trend" and "Discount by Outlet"
// cards — see sale.service.js's getDiscountSummary for exactly what this
// does and doesn't represent.
router.get('/discount-summary', async (req, res, next) => {
  try {
    const summary = await getDiscountSummary(req.user.tenantId);
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});

// Feeds the Customer page's top "Total Sales (This Month)"/"Outstanding
// Amount" tiles — see sale.service.js's getSalesOverviewSummary.
router.get('/overview-summary', async (req, res, next) => {
  try {
    const summary = await getSalesOverviewSummary(req.user.tenantId);
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});

// Feeds the Customer list table's per-row Total Purchase/Outstanding
// columns in one query — see sale.service.js's getCustomerPurchaseSummaries.
router.get('/customer-summaries', async (req, res, next) => {
  try {
    const summaries = await getCustomerPurchaseSummaries(req.user.tenantId);
    res.json({ success: true, data: summaries });
  } catch (err) {
    next(err);
  }
});

// Feeds the Customer detail panel/view page's Total Purchase/Outstanding
// figures and its real Recent Transactions list — see sale.service.js's
// getCustomerPurchaseSummary.
router.get('/customer/:customerId', async (req, res, next) => {
  try {
    const summary = await getCustomerPurchaseSummary(req.user.tenantId, req.params.customerId);
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});

// Feeds the Cashier Panel's Cash Sales report — stat tiles, Sales
// Summary/Payment Summary cards, the payment-mix donut, and the paginated
// Recent Cash Sales Transactions table. Scoped to the cashier's own outlet
// (from their JWT, same as createSale) so one cashier never sees another
// outlet's cash drawer. See sale.service.js's getCashSalesReport for exactly
// which figures are all-time vs. scoped to the `date` query param.
router.get('/cash-summary', validateRequest(cashSalesQuerySchema, 'query'), async (req, res, next) => {
  try {
    const report = await getCashSalesReport(req.user.tenantId, req.user.outletId, req.query);
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

// Feeds the Cashier Panel's Card Sales report — same shape as the Cash
// Sales report above, scoped to card-tender sales instead. See
// sale.service.js's getCardSalesReport for exactly which figures are
// all-time vs. scoped to the `date` query param, and the caveat about
// card type/last-4/bank not being captured by checkout yet.
router.get('/card-summary', validateRequest(cardSalesQuerySchema, 'query'), async (req, res, next) => {
  try {
    const report = await getCardSalesReport(req.user.tenantId, req.user.outletId, req.query);
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

// Feeds the Cashier Panel's UPI Sales report — same shape as the Cash
// Sales report above, scoped to UPI-tender sales instead. See
// sale.service.js's getUpiSalesReport for exactly which figures are
// all-time vs. scoped to the `date` query param, and the caveat about the
// UPI app/transaction ID not being captured by checkout yet.
router.get('/upi-summary', validateRequest(upiSalesQuerySchema, 'query'), async (req, res, next) => {
  try {
    const report = await getUpiSalesReport(req.user.tenantId, req.user.outletId, req.query);
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

// Feeds the Cashier Panel's Other Payments report — the miscellaneous-
// tender bucket (store credit, gift card, wallet, credit, cheque, bank
// transfer). See sale.service.js's getOtherPaymentsReport for exactly which
// figures are all-time vs. scoped to the `date` query param, the real
// same-day cash/card/upi context lines, and the caveat about
// paymentReference not being captured by checkout yet.
router.get('/other-summary', validateRequest(otherPaymentsQuerySchema, 'query'), async (req, res, next) => {
  try {
    const report = await getOtherPaymentsReport(req.user.tenantId, req.user.outletId, req.query);
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

// Creates and immediately settles a Line Sale bill — see sale.service.js's
// createSale for the stock check + totals math, all done server-side inside
// one transaction. `outletId` comes from the cashier's own JWT (the outlet
// they logged into), never from the request body, so it can't be spoofed.
router.post('/', validateRequest(createSaleSchema), async (req, res, next) => {
  try {
    const sale = await createSale({
      tenantId: req.user.tenantId, outletId: req.user.outletId, ...req.body, actor: req.user,
    });
    res.status(201).json({ success: true, data: sale });
  } catch (err) {
    next(err);
  }
});

export default router;
