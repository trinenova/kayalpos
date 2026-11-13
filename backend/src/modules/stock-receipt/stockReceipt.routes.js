import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { createStockReceiptSchema, updateStockReceiptSchema } from './stockReceipt.schema.js';
import { importReceiptsSchema, importStockReceipts } from './stockReceipt.import.js';
import {
  listStockReceipts, getStockReceipt, createStockReceipt, updateStockReceipt,
  deleteStockReceipt, nextCodePreview, getStockReceiptSummary,
} from './stockReceipt.service.js';

const router = Router();
router.use(requireAuth);

// Live "RCPT-00039"-style preview for the New Stock Receipt screen's
// disabled Receipt No. field — same idea as every other module's next-code
// preview.
router.get('/next-code', async (req, res, next) => {
  try {
    const code = await nextCodePreview(req.user.tenantId);
    res.json({ success: true, data: { code } });
  } catch (err) { next(err); }
});

// Feeds the Stock Receipt page's top 5-tile summary strip — see
// stockReceipt.service.js's getStockReceiptSummary.
router.get('/summary', async (req, res, next) => {
  try {
    const summary = await getStockReceiptSummary(req.user.tenantId);
    res.json({ success: true, data: summary });
  } catch (err) { next(err); }
});

// Excel import (Stock Receipt > Import Receipts) — one call per batch of receipts.
router.post('/import', validateRequest(importReceiptsSchema), async (req, res, next) => {
  try {
    const summary = await importStockReceipts(req.user.tenantId, req.body.receipts, req.user);
    res.json({ success: true, data: summary });
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const rows = await listStockReceipts(req.user.tenantId, req.query);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await getStockReceipt(req.user.tenantId, req.params.id);
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
});

router.post('/', validateRequest(createStockReceiptSchema), async (req, res, next) => {
  try {
    const row = await createStockReceipt(req.user.tenantId, req.body, req.user);
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
});

router.put('/:id', validateRequest(updateStockReceiptSchema), async (req, res, next) => {
  try {
    const row = await updateStockReceipt(req.user.tenantId, req.params.id, req.body, req.user);
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await deleteStockReceipt(req.user.tenantId, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

export default router;
