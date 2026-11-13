import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { grossProfitQuerySchema } from './grossProfit.schema.js';
import { getGrossProfitReport, listGrossProfitFilterOptions } from './grossProfit.service.js';

const router = Router();
router.use(requireAuth);

router.get('/', validateRequest(grossProfitQuerySchema, 'query'), async (req, res, next) => {
  try {
    res.json({ success: true, data: await getGrossProfitReport(req.user, req.query) });
  } catch (err) {
    next(err);
  }
});

router.get('/filters', async (req, res, next) => {
  try {
    res.json({ success: true, data: await listGrossProfitFilterOptions(req.user) });
  } catch (err) {
    next(err);
  }
});

export default router;
