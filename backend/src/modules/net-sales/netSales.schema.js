import { z } from 'zod';

const dateKey = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

// from/to are server-local calendar days (default: last 7 days). outletId is a
// real outlet id or "all"; omitted = the caller's own outlet.
export const netSalesQuerySchema = z.object({
  from: dateKey.optional(),
  to: dateKey.optional(),
  outletId: z.string().trim().min(1).optional(),
});
