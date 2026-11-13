import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { reportQuerySchema, listFilterOptions } from './common.js';
import { getProfitabilityReport } from './profitability.service.js';
import { getTaxSummaryReport } from './taxSummary.service.js';
import { getOutstandingReport } from './outstanding.service.js';
import { getPaymentCollectionReport } from './paymentCollection.service.js';

const router = Router();
router.use(requireAuth);

const report = (path, fn) => router.get(path, validateRequest(reportQuerySchema, 'query'), async (req, res, next) => {
  try {
    res.json({ success: true, data: await fn(req.user, req.query) });
  } catch (err) {
    next(err);
  }
});

report('/profitability', getProfitabilityReport);
report('/tax-summary', getTaxSummaryReport);
report('/outstanding', getOutstandingReport);
report('/payment-collection', getPaymentCollectionReport);

router.get('/filters', async (req, res, next) => {
  try {
    res.json({ success: true, data: await listFilterOptions(req.user) });
  } catch (err) {
    next(err);
  }
});

export default router;
