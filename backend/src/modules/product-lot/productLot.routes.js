import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { listOpenLotsForProducts } from './productLot.service.js';

const router = Router();
router.use(requireAuth);

// Open FIFO lots (oldest first) with stock left. Optional ?productId=a,b filter.
// Read-only: the Line Sale screen uses it to price a quantity across lots.
router.get('/', async (req, res, next) => {
  try {
    const ids = typeof req.query.productId === 'string' && req.query.productId
      ? req.query.productId.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    res.json({ success: true, data: await listOpenLotsForProducts(req.user.tenantId, ids) });
  } catch (err) {
    next(err);
  }
});

export default router;
