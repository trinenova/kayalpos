import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { expenseReportQuerySchema } from './expenseReport.schema.js';
import { getExpenseReport, listExpenseReportFilterOptions } from './expenseReport.service.js';

const router = Router();
router.use(requireAuth);

router.get('/', validateRequest(expenseReportQuerySchema, 'query'), async (req, res, next) => {
  try {
    res.json({ success: true, data: await getExpenseReport(req.user, req.query) });
  } catch (err) {
    next(err);
  }
});

router.get('/filters', async (req, res, next) => {
  try {
    res.json({ success: true, data: await listExpenseReportFilterOptions(req.user) });
  } catch (err) {
    next(err);
  }
});

export default router;
