import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { ApiError } from '../middleware/errorHandler.js';
import { createMemoryCache } from './memoryCache.js';

const MAX_PAGE_SIZE = 200;
// Safety cap for the unpaginated (legacy) list call — existing pages that
// don't pass page/pageSize keep getting a flat array back, but never an
// unbounded one, however large the table grows.
const UNPAGINATED_LIMIT = 1000;

/**
 * Generic CRUD router factory over a Prisma delegate (e.g. prisma.brand).
 * Every master-data module (Brand, Product, Supplier, Employee, ...) follows
 * the same tenant-scoped list/get/create/update/delete shape, so this one
 * factory replaces hand-written routes/controller/service boilerplate per
 * module. Modules with extra behavior (custom lookups, cross-entity writes)
 * can still add their own routes alongside — this only covers the common
 * 80%.
 *
 * Every route requires auth and every query/write is scoped to
 * req.user.tenantId, so one tenant can never read or mutate another
 * tenant's rows.
 *
 * @param {object} opts
 * @param {object} opts.model - a Prisma delegate, e.g. prisma.brand
 * @param {import('zod').ZodSchema} opts.createSchema
 * @param {import('zod').ZodSchema} opts.updateSchema
 * @param {string[]} [opts.searchFields] - string fields matched by ?search=
 * @param {object} [opts.orderBy] - default sort, e.g. { createdAt: 'desc' }
 * @param {string} [opts.codePrefix] - e.g. 'BR' to auto-generate BR001, BR002...
 * @param {string} [opts.codeField] - field name the generated code is written to (default 'code')
 * @param {number} [opts.codeLength] - digits to zero-pad the sequence to (default 3, e.g. BR001; pass 4 for PROD0001)
 * @param {object} [opts.listSelect] - Prisma `select` object to trim the list
 *   response to only the columns the UI needs (e.g. omit tenantId). Omit to
 *   return full rows (get/create/update always return full rows regardless).
 * @param {object} [opts.detailInclude] - Prisma `include` object applied only
 *   to the single-record GET /:id route, for a module whose detail screen
 *   needs a related list the plain list view doesn't (e.g. Outlet's
 *   `{ contacts: { orderBy: { createdAt: 'asc' } } }`). Omit for the plain
 *   scalar-only row every other module already gets.
 * @param {number} [opts.cacheTtlMs] - list-response cache TTL; 0 disables caching.
 */
export function createCrudRouter({
  model,
  createSchema,
  updateSchema,
  searchFields = [],
  orderBy = { createdAt: 'desc' },
  codePrefix,
  codeField = 'code',
  codeLength = 3,
  listSelect,
  detailInclude,
  cacheTtlMs = 15_000,
}) {
  const router = Router();
  router.use(requireAuth);

  // One cache instance per router (i.e. per entity — Brand, Product,
  // Customer each get their own), keyed by tenant + query shape. Any write
  // below clears it, so a save is visible on the very next list call.
  const listCache = createMemoryCache({ ttlMs: cacheTtlMs });
  // Lets a module's own bulk-write route (e.g. an Excel import) drop the cached
  // list so the very next list call shows the new rows.
  router.clearListCache = () => listCache.clear();

  function buildWhere(req) {
    const { search, status, isActive } = req.query;
    const where = { tenantId: req.user.tenantId };

    if (status && status !== 'All') {
      where.status = String(status).toUpperCase();
    }
    // For a model with a plain `isActive` boolean instead of a `status`
    // enum (e.g. Outlet) — separate query param so it never collides with
    // `status` above on a model that has both concepts.
    if (isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true' || isActive === true;
    }
    if (search && searchFields.length) {
      where.OR = searchFields.map((field) => ({
        [field]: { contains: String(search), mode: 'insensitive' },
      }));
    }
    return where;
  }

  router.get('/', async (req, res, next) => {
    try {
      const where = buildWhere(req);
      const { page, pageSize } = req.query;
      const isPaginated = page !== undefined || pageSize !== undefined;

      const cacheKey = JSON.stringify({ tenantId: req.user.tenantId, query: req.query });
      if (cacheTtlMs > 0) {
        const cached = listCache.get(cacheKey);
        if (cached) return res.json(cached);
      }

      let payload;
      if (isPaginated) {
        const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
        const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(pageSize, 10) || 50));

        const [rows, total] = await Promise.all([
          model.findMany({
            where,
            orderBy,
            select: listSelect,
            skip: (pageNum - 1) * size,
            take: size,
          }),
          model.count({ where }),
        ]);

        payload = {
          success: true,
          data: rows,
          meta: { page: pageNum, pageSize: size, total, totalPages: Math.max(1, Math.ceil(total / size)) },
        };
      } else {
        // Legacy shape (no meta) for existing callers — still bounded so an
        // old client can never pull an unbounded table into memory.
        const rows = await model.findMany({ where, orderBy, select: listSelect, take: UNPAGINATED_LIMIT });
        payload = { success: true, data: rows };
      }

      if (cacheTtlMs > 0) listCache.set(cacheKey, payload);
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const row = await model.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId }, include: detailInclude });
      if (!row) throw new ApiError(404, 'Record not found');
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', validateRequest(createSchema), async (req, res, next) => {
    try {
      const data = { ...req.body, tenantId: req.user.tenantId };

      if (codePrefix && !data[codeField]) {
        data[codeField] = await nextCode({ model, tenantId: req.user.tenantId, prefix: codePrefix, length: codeLength, field: codeField });
      }

      const row = await model.create({ data });
      listCache.clear();
      res.status(201).json({ success: true, data: row });
    } catch (err) {
      next(prismaKnownError(err));
    }
  });

  router.put('/:id', validateRequest(updateSchema), async (req, res, next) => {
    try {
      const existing = await model.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId } });
      if (!existing) throw new ApiError(404, 'Record not found');

      const row = await model.update({ where: { id: req.params.id }, data: req.body });
      listCache.clear();
      res.json({ success: true, data: row });
    } catch (err) {
      next(prismaKnownError(err));
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const existing = await model.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId } });
      if (!existing) throw new ApiError(404, 'Record not found');

      await model.delete({ where: { id: req.params.id } });
      listCache.clear();
      res.json({ success: true, data: { id: req.params.id } });
    } catch (err) {
      next(prismaKnownError(err, { onDeleteConflict: true }));
    }
  });

  return router;
}

/**
 * Generates the next sequential code for a tenant (e.g. BR001, BR002, ...).
 * Uses a row count rather than a dedicated sequence table — good enough for
 * the current single-admin, low-concurrency dev/demo usage. If concurrent
 * writes ever become a real concern, replace this with a DocumentNumberSeries
 * table (already anticipated in the architecture proposal) guarded by a
 * transaction.
 */
async function nextCode({ model, tenantId, prefix, length = 3, field = 'code' }) {
  // Highest existing numeric suffix + 1 (not row count + 1): after any delete
  // the count-based code collided with an existing one and Save failed with a
  // 409 "already exists". Also copes with mixed PROD0001 / PROD-0001 codes.
  const rows = await model.findMany({ where: { tenantId, [field]: { startsWith: prefix } }, select: { [field]: true } });
  const max = rows.reduce((m, r) => {
    const n = Number.parseInt(String(r[field]).match(/(\d+)$/)?.[1] ?? '0', 10);
    return n > m ? n : m;
  }, 0);
  return `${prefix}${String(max + 1).padStart(length, '0')}`;
}

/**
 * Turns known Prisma error codes into friendly 4xx responses instead of a
 * raw 500. `onDeleteConflict` is only passed by the DELETE route — P2003
 * there means "this row is still referenced elsewhere" (e.g. an Outlet
 * with existing Sales/ShiftSessions/Expenses), which is a normal, expected
 * 409 for that route, not a server error.
 */
function prismaKnownError(err, { onDeleteConflict = false } = {}) {
  if (err?.code === 'P2002') {
    return new ApiError(409, 'A record with that value already exists', err.meta);
  }
  if (onDeleteConflict && err?.code === 'P2003') {
    return new ApiError(409, 'This record still has related data (sales, shifts, cash transactions, or expenses) and cannot be deleted', err.meta);
  }
  return err;
}
