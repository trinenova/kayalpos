import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import {
  createSellingPriceSchema, updateSellingPriceSchema, sellingPriceQuerySchema,
  priceGridQuerySchema, bulkUpdatePriceGridSchema,
} from './sellingPrice.schema.js';
import {
  listSellingPrices, getSellingPriceById, createSellingPrice, updateSellingPrice, deleteSellingPrice,
  listPriceGrid, bulkUpdatePriceGrid, listPriceHistory,
} from './sellingPrice.service.js';

// Masters > Selling Price. Unlike most master-data modules (Brand, HSN/SAC,
// Product, ...) this one does NOT use utils/crudFactory.js — the list view
// needs to join in the related Product/Outlet (for item code/name and
// outlet name in the table), and every write needs the item/outlet to be
// re-validated and the selling price recomputed server-side (see
// sellingPrice.service.js's computePricing), neither of which the generic
// factory supports. Same "custom service module" pattern as Expense/Outlet's
// contacts sub-resource.
const router = Router();
router.use(requireAuth);

router.get('/', validateRequest(sellingPriceQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { rows, meta } = await listSellingPrices(req.user.tenantId, req.query);
    res.json({ success: true, data: rows, meta });
  } catch (err) {
    next(err);
  }
});

// Price List screen's flat grid — declared before '/:id' so "grid" is
// never swallowed by that param route.
router.get('/grid', validateRequest(priceGridQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { rows, meta } = await listPriceGrid(req.user.tenantId, req.query);
    res.json({ success: true, data: rows, meta });
  } catch (err) {
    next(err);
  }
});

router.post('/grid/bulk-update', validateRequest(bulkUpdatePriceGridSchema), async (req, res, next) => {
  try {
    const result = await bulkUpdatePriceGrid(req.user.tenantId, req.body.updates, req.user.name);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Actions column's "Price History" dialog — also declared before '/:id'.
router.get('/grid/:productId/history', async (req, res, next) => {
  try {
    const rows = await listPriceHistory(req.user.tenantId, req.params.productId);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await getSellingPriceById(req.user.tenantId, req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

router.post('/', validateRequest(createSellingPriceSchema), async (req, res, next) => {
  try {
    const row = await createSellingPrice(req.user.tenantId, req.body);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', validateRequest(updateSellingPriceSchema), async (req, res, next) => {
  try {
    const row = await updateSellingPrice(req.user.tenantId, req.params.id, req.body);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await deleteSellingPrice(req.user.tenantId, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
