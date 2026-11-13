import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { netSalesQuerySchema } from './netSales.schema.js';
import { getNetSalesReport, listNetSalesFilterOptions } from './netSales.service.js';

const router = Router();
router.use(requireAuth);

router.get('/', validateRequest(netSalesQuerySchema, 'query'), async (req, res, next) => {
  try {
    res.json({ success: true, data: await getNetSalesReport(req.user, req.query) });
  } catch (err) {
    next(err);
  }
});

router.get('/filters', async (req, res, next) => {
  try {
    res.json({ success: true, data: await listNetSalesFilterOptions(req.user) });
  } catch (err) {
    next(err);
  }
});

export default router;
