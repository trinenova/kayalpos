import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { createBarcodeLabelSchema, updateBarcodeLabelSchema } from './barcodeLabel.schema.js';
import {
  listBarcodeLabelBatches, getBarcodeLabelBatch, createBarcodeLabelBatch, updateBarcodeLabelBatch,
  deleteBarcodeLabelBatch, nextCodePreview, getBarcodeLabelSummary, getBarcodeLabelStatusSummary,
  generateBarcodesForBatch, listBarcodeGenerationHistory,
} from './barcodeLabel.service.js';

const router = Router();
router.use(requireAuth);

// Live "LBL-00039"-style preview for the New Barcode & Label screen's
// disabled Batch No. field — same idea as every other module's next-code
// preview.
router.get('/next-code', async (req, res, next) => {
  try {
    const code = await nextCodePreview(req.user.tenantId);
    res.json({ success: true, data: { code } });
  } catch (err) { next(err); }
});

// Feeds the Barcode & Label page's top 5-tile summary strip — see
// barcodeLabel.service.js's getBarcodeLabelSummary.
router.get('/summary', async (req, res, next) => {
  try {
    const summary = await getBarcodeLabelSummary(req.user.tenantId);
    res.json({ success: true, data: summary });
  } catch (err) { next(err); }
});

// Feeds the Draft/Pending Print/Printed status pages' 4-tile strip for one
// status at a time — see barcodeLabel.service.js's getBarcodeLabelStatusSummary.
// Placed before '/:id' so 'status-summary' is never mistaken for a batch id.
router.get('/status-summary/:status', async (req, res, next) => {
  try {
    const summary = await getBarcodeLabelStatusSummary(req.user.tenantId, req.params.status);
    res.json({ success: true, data: summary });
  } catch (err) { next(err); }
});

// Feeds the "Barcode History" tab — see barcodeLabel.service.js's
// listBarcodeGenerationHistory. Placed before '/:id' so 'history' is never
// mistaken for a batch id, same reason as 'status-summary' above.
router.get('/history', async (req, res, next) => {
  try {
    const rows = await listBarcodeGenerationHistory(req.user.tenantId, req.query);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const rows = await listBarcodeLabelBatches(req.user.tenantId, req.query);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await getBarcodeLabelBatch(req.user.tenantId, req.params.id);
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
});

router.post('/', validateRequest(createBarcodeLabelSchema), async (req, res, next) => {
  try {
    const row = await createBarcodeLabelBatch(req.user.tenantId, req.body, req.user);
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
});

// The real "Generate" action behind Print / Preview's "Generate & Save to
// History" button — resolves and permanently logs every item's barcode
// value and flips the batch to 'printed' (see generateBarcodesForBatch).
// No request body: there's nothing for the client to supply beyond which
// batch.
router.post('/:id/generate', async (req, res, next) => {
  try {
    const result = await generateBarcodesForBatch(req.user.tenantId, req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.put('/:id', validateRequest(updateBarcodeLabelSchema), async (req, res, next) => {
  try {
    const row = await updateBarcodeLabelBatch(req.user.tenantId, req.params.id, req.body, req.user);
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await deleteBarcodeLabelBatch(req.user.tenantId, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

export default router;
