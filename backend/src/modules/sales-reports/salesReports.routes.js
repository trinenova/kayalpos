import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { salesReportQuerySchema } from './salesReports.schema.js';
import {
  listSalesReportFilters, getHourlySalesReport, getHourlySalesItems, getPaymentWiseSalesReport, getDiscountReport, getTaxReport, getReturnReport,
} from './salesReports.service.js';

const router = Router();
router.use(requireAuth);

// Read-only: every /reports/sales/* report is derived from real Sale /
// LinesaleItemDetails / SalesReturn rows — see salesReports.service.js.
// Nothing here is written.

router.get('/filters', async (req, res, next) => {
  try {
    res.json({ success: true, data: await listSalesReportFilters(req.user) });
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

export default router;
