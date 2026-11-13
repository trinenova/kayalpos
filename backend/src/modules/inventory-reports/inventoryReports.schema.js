import { z } from 'zod';

const dateKey = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

const pageParams = {
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(20),
};

// Current Stock / Low Stock / Out-of-Stock / Stock Valuation — Product has no
// date dimension of its own, so these four just search + paginate a snapshot.
export const stockLevelQuerySchema = z.object({
  search: z.string().trim().optional(),
  ...pageParams,
});

export const batchExpiryQuerySchema = z.object({
  warehouseId: z.string().trim().min(1).optional(),
  status: z.enum(['all', 'expired', 'expiring-soon', 'active']).default('all'),
  search: z.string().trim().optional(),
  ...pageParams,
});

export const wastageQuerySchema = z.object({
  from: dateKey.optional(),
  to: dateKey.optional(),
  outletId: z.string().trim().min(1).optional(),
  search: z.string().trim().optional(),
  ...pageParams,
});

export const countVarianceQuerySchema = z.object({
  from: dateKey.optional(),
  to: dateKey.optional(),
  warehouse: z.string().trim().min(1).optional(),
  search: z.string().trim().optional(),
  ...pageParams,
});

export const movementRankingQuerySchema = z.object({
  from: dateKey.optional(),
  to: dateKey.optional(),
  search: z.string().trim().optional(),
  ...pageParams,
});

export const stockMovementQuerySchema = z.object({
  from: dateKey.optional(),
  to: dateKey.optional(),
  type: z.enum(['all', 'in', 'out']).default('all'),
  search: z.string().trim().optional(),
  ...pageParams,
});
