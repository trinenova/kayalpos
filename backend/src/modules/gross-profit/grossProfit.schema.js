import { z } from 'zod';

const dateKey = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

// from/to are server-local calendar days; both default in the service to the
// last 7 days. outletId is a real outlet id or "all"; omitted = caller's outlet.
export const grossProfitQuerySchema = z.object({
  from: dateKey.optional(),
  to: dateKey.optional(),
  outletId: z.string().trim().min(1).optional(),
});
