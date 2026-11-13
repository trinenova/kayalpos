import { z } from 'zod';

const dateKey = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

// ---------------------------------------------------------------------------
// Hourly Sales, Payment-wise Sales, Discount Report, Tax Report, Return Report
// — same filter set, just a different source table per report (see
// salesReports.service.js).
// ---------------------------------------------------------------------------
export const salesReportQuerySchema = z.object({
  from: dateKey.optional(),
  to: dateKey.optional(),
  outletId: z.string().trim().min(1).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(20),
});

// ---------------------------------------------------------------------------
// Daily, Monthly, Outlet-wise, Cashier-wise, Item-wise, Category-wise,
// Brand-wise and Customer-wise Sales (see salesReportsSummary.service.js).
// ---------------------------------------------------------------------------
export const REPORT_TYPES = [
  'daily', 'monthly', 'outlet', 'cashier', 'item', 'category', 'brand', 'customer',
];

// Longest range one request may cover. Keeps a single report from pulling a
// whole year-after-year history of bills into memory.
export const MAX_RANGE_DAYS = 366;

export const reportParamsSchema = z.object({
  report: z.enum(REPORT_TYPES, { message: `Unknown report — use one of ${REPORT_TYPES.join(', ')}` }),
});

export const reportQuerySchema = z.object({
  from: dateKey.optional(),
  to: dateKey.optional(),
  outletId: z.string().trim().min(1).optional(),
  cashier: z.string().trim().min(1).optional(),
  // Free-text filter on the report's own row label (item / customer / outlet ...).
  search: z.string().trim().max(100).optional(),
}).superRefine((q, ctx) => {
  if (q.from && q.to && q.from > q.to) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: '"To" date cannot be before "From" date' });
  }
  if (q.from && q.to) {
    const days = (Date.parse(`${q.to}T00:00:00Z`) - Date.parse(`${q.from}T00:00:00Z`)) / 86400000 + 1;
    if (days > MAX_RANGE_DAYS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: `Date range cannot exceed ${MAX_RANGE_DAYS} days` });
    }
  }
});
