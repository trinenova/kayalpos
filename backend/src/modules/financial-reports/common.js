import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { outletIdFilter, outletAnd, outletFieldFilter } from '../../utils/outletScope.js';

// Shared by the Profitability / Tax Summary / Outstanding / Payment Collection
// reports (Reports > Financial Reports). All are read-only.
export const MAX_RANGE_DAYS = 366;
export const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
export const n = (v) => Number(v || 0);

const dateKey = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

// from/to are server-local calendar days (default: last 7 days). outletId is a
// real outlet id or "all"; omitted = the caller's own outlet.
export const reportQuerySchema = z.object({
  from: dateKey.optional(),
  to: dateKey.optional(),
  outletId: z.string().trim().min(1).optional(),
});

export function dateKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dayBounds(dateStr) {
  const start = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(start.getTime())) throw new ApiError(400, 'Invalid date');
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Validated { from, to, start, end } with the 7-day default and range cap. */
export function resolveRange(params = {}) {
  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  const from = params.from || dateKeyOf(weekAgo);
  const to = params.to || dateKeyOf(today);
  const { start } = dayBounds(from);
  const { end } = dayBounds(to);
  if (end < start) throw new ApiError(400, '"To" date cannot be before "From" date');
  if ((end - start) / 86400000 > MAX_RANGE_DAYS) throw new ApiError(400, `Date range cannot exceed ${MAX_RANGE_DAYS} days`);
  return { from, to, start, end };
}

export async function resolveOutletIds(user, outletId) {
  const mayChoose = user.role === 'ADMIN';
  if (!mayChoose || !outletId) {
    if (!user.outletId) throw new ApiError(400, 'No outlet is assigned to your session');
    return [user.outletId];
  }
  if (outletId === 'all') {
    const outlets = await prisma.outlet.findMany({ where: { tenantId: user.tenantId, ...outletIdFilter(user) }, select: { id: true } });
    return outlets.map((o) => o.id);
  }
  const outlet = await prisma.outlet.findFirst({ where: { id: outletId, tenantId: user.tenantId, ...outletAnd(user) }, select: { id: true } });
  if (!outlet) throw new ApiError(404, 'Outlet not found');
  return [outlet.id];
}

export async function listFilterOptions(user) {
  const mayChoose = user.role === 'ADMIN';
  const outlets = await prisma.outlet.findMany({
    where: { tenantId: user.tenantId, ...(mayChoose ? outletIdFilter(user) : { id: user.outletId || '' }) },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return { outlets, canChooseOutlet: mayChoose };
}
