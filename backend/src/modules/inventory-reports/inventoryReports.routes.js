import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import {
  stockLevelQuerySchema, batchExpiryQuerySchema, wastageQuerySchema, countVarianceQuerySchema,
  movementRankingQuerySchema, stockMovementQuerySchema,
} from './inventoryReports.schema.js';
import {
  listInventoryReportFilters, getCurrentStockReport, getLowStockReport, getOutOfStockReport, getStockValuationReport,
  getBatchExpiryReport, getWastageReport, getStockAdjustmentReport, getPhysicalStockVarianceReport,
  getSlowMovingReport, getFastMovingReport, getStockMovementReport,
} from './inventoryReports.service.js';

const router = Router();
router.use(requireAuth);

// Read-only: every /reports/inventory/* report is derived from real Product /
// BatchSerial / StockWastage / StockCount / StockReceipt / StockReturn /
// Sale rows — see inventoryReports.service.js. Nothing here is written.

function get(path, schema, handler) {
  router.get(path, validateRequest(schema, 'query'), async (req, res, next) => {
    try {
      res.json({ success: true, data: await handler(req.user, req.query) });
    } catch (err) {
      next(err);
    }
  });
}

router.get('/filters', async (req, res, next) => {
  try {
    res.json({ success: true, data: await listInventoryReportFilters(req.user) });
  } catch (err) {
    next(err);
  }
});

get('/current-stock', stockLevelQuerySchema, getCurrentStockReport);
get('/low-stock', stockLevelQuerySchema, getLowStockReport);
get('/out-of-stock', stockLevelQuerySchema, getOutOfStockReport);
get('/stock-valuation', stockLevelQuerySchema, getStockValuationReport);
get('/batch-expiry', batchExpiryQuerySchema, getBatchExpiryReport);
get('/wastage', wastageQuerySchema, getWastageReport);
get('/stock-adjustment', countVarianceQuerySchema, getStockAdjustmentReport);
get('/physical-stock-variance', countVarianceQuerySchema, getPhysicalStockVarianceReport);
get('/slow-moving-items', movementRankingQuerySchema, getSlowMovingReport);
get('/fast-moving-items', movementRankingQuerySchema, getFastMovingReport);
get('/stock-movement', stockMovementQuerySchema, getStockMovementReport);

export default router;
