import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { cashierReportQuerySchema } from './cashierReports.schema.js';
import {
  listCashierReportFilters, getCashierSalesReport, getPaymentCollectionReport, getCashShortageExcessReport,
} from './cashierReports.service.js';

const router = Router();
router.use(requireAuth);

// Read-only: every /reports/cashier/* report is derived from real Sale /
// LinesaleItemDetails / SalesReturn / ShiftSession rows — see
// cashierReports.service.js. Nothing here is written.

router.get('/filters', async (req, res, next) => {
  try {
    res.json({ success: true, data: await listCashierReportFilters(req.user) });
  } catch (err) {
    next(err);
  }
});

function get(path, handler) {
  router.get(path, validateRequest(cashierReportQuerySchema, 'query'), async (req, res, next) => {
    try {
      res.json({ success: true, data: await handler(req.user, req.query) });
    } catch (err) {
      next(err);
    }
  });
}

get('/cashier-sales', getCashierSalesReport);
get('/payment-collection', getPaymentCollectionReport);
get('/cash-shortage-excess', getCashShortageExcessReport);

export default router;
