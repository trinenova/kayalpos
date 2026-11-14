import { prisma } from '../../config/prisma.js';
import { createCrudRouter } from '../../utils/crudFactory.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { ApiError } from '../../middleware/errorHandler.js';
import {
  createProductSchema, updateProductSchema, normalizeBulkProductRow, bulkProductImportSchema,
} from './product.schema.js';

const router = createCrudRouter({
  model: prisma.product,
  createSchema: createProductSchema,
  updateSchema: updateProductSchema,
  searchFields: ['code', 'shortId', 'name'],
  codePrefix: 'PROD',
  codeLength: 4,
});

/**
 * Bulk import — one call per chunk from the frontend's chunked Excel
 * uploader (see modules/masters/product/components/ProductBulkImportDialog).
 * Each row is validated independently with the same zod schema single
 * create uses, so a bad row never aborts the whole chunk: valid rows are
 * still written, and every invalid row is reported back with its original
 * position (`row`, 1-based within THIS chunk) and the validation message, so
 * the frontend can show a precise per-row error list.
 *
 * Rows with an existing `code` update that product; rows without one are
 * created with an auto-generated code, processed sequentially (not
 * Promise.all) so the auto-generated codes within one chunk don't collide —
 * see crudFactory's nextCode() for why this is count-based rather than a
 * real sequence.
 */
router.post('/bulk', requireAuth, validateRequest(bulkProductImportSchema), async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const { rows } = req.body;

    let created = 0;
    let updated = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i += 1) {
      const rawRow = rows[i];
      // Lenient import: no field validation; rows with nothing in them are skipped.
      const code = String(rawRow?.code ?? '').trim();
      const existing = code ? await prisma.product.findUnique({ where: { tenantId_code: { tenantId, code } } }) : null;
      const data = normalizeBulkProductRow(rawRow, { isNew: !existing });
      if (!data) continue; // eslint-disable-line no-continue

      const save = async (payload) => {
        if (existing) {
          await prisma.product.update({ where: { id: existing.id }, data: payload });
          return 'updated';
        }
        const body = { ...payload };
        if (!body.code) {
          const count = await prisma.product.count({ where: { tenantId } });
          // Matches crudFactory's nextCode() convention (PREFIX-NNNN) used by
          // the single-row create endpoint, so bulk-imported and manually
          // created products never end up with mismatched code formats.
          body.code = `PROD-${String(count + 1).padStart(4, '0')}`;
        }
        await prisma.product.create({ data: { ...body, tenantId } });
        return 'created';
      };
      try {
        let outcome;
        try {
          outcome = await save(data);
        } catch (err) {
          // A Short ID that already belongs to another product must not fail
          // the row: import it without the Short ID instead.
          if (err?.code === 'P2002' && data.shortId) {
            const { shortId, ...rest } = data; // eslint-disable-line no-unused-vars
            outcome = await save(rest);
          } else {
            throw err;
          }
        }
        if (outcome === 'updated') updated += 1; else created += 1;
      } catch (err) {
        errors.push({ row: i + 1, code: data.code, message: err?.code === 'P2002' ? 'Duplicate product code' : 'Failed to save row' });
      }
    }

    res.json({
      success: true,
      data: { total: rows.length, created, updated, failed: errors.length, errors },
    });
  } catch (err) {
    next(err);
  }
});

// Friendlier message when the unique (tenant, ShortId) constraint is what
// failed — crudFactory's generic 409 can't say which field collided. Any
// other error falls straight through to the app-level error handler.
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err?.statusCode === 409 && /shortid/i.test(JSON.stringify(err.details ?? ''))) {
    return next(new ApiError(409, 'That Short ID is already used by another product', err.details));
  }
  return next(err);
});

export default router;
