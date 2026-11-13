import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { salesReportQuerySchema, reportParamsSchema, reportQuerySchema } from './salesReports.schema.js';
import {
  listSalesReportFilters, getHourlySalesReport, getHourlySalesItems, getPaymentWiseSalesReport,
  getDiscountReport, getTaxReport, getReturnReport,
} from './salesReports.service.js';
import { getSalesSummaryReport, listSalesCashiers } from './salesReportsSummary.service.js';

const router = Router();
router.use(requireAuth);

// Read-only: every /reports/sales/* report is derived from real Sale /
// LinesaleItemDetails / SalesReturn rows — see salesReports.service.js
// (Hourly / Payment-wise / Discount / Tax / Return) and
// salesReportsSummary.service.js (Daily ... Customer-wise). Nothing here is written.

// Shared filter bar data: outlets this user may choose from, whether they may
// choose at all, and the cashiers who have sold at those outlets.
router.get('/filters', async (req, res, next) => {
  try {
    const base = await listSalesReportFilters(req.user);
    const cashiers = await listSalesCashiers(req.user, base.outlets.map((o) => o.id));
    res.json({ success: true, data: { ...base, cashiers } });
  } catch (err) {
    next(err);
  }
});

function get(path, handler) {
  router.get(path, validateRequest(salesReportQuerySchema, 'query'), async (req, res, next) => {
    try {
      res.json({ success: true, data: await handler(req.user, req.query) });
    } catch (err) {
      next(err);
    }
  });
}

get('/hourly-sales', getHourlySalesReport);

// Drill-down: every item sold within one hour-of-day bucket (0-23).
router.get('/hourly-sales/:hour/items', validateRequest(salesReportQuerySchema, 'query'), async (req, res, next) => {
  try {
    res.json({ success: true, data: await getHourlySalesItems(req.user, Number(req.params.hour), req.query) });
  } catch (err) {
    next(err);
  }
});
get('/payment-wise-sales', getPaymentWiseSalesReport);
get('/discount-report', getDiscountReport);
get('/tax-report', getTaxReport);
get('/return-report', getReturnReport);

// Daily | monthly | outlet | cashier | item | category | brand | customer.
// Declared LAST so it can never shadow the fixed paths above.
router.get(
  '/:report',
  validateRequest(reportParamsSchema, 'params'),
  validateRequest(reportQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      res.json({ success: true, data: await getSalesSummaryReport(req.user, req.params.report, req.query) });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
