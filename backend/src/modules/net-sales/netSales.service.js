import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../middleware/errorHandler.js';

/**
 * Net Sales report (Reports > Financial Reports > Net Sales). Read-only,
 * derived from existing rows (COMPLETED Linesales bills + SalesReturn):
 *   Gross sales   = sum of bill sub totals (before discount and GST)
 *   Discounts     = sum of bill discount amounts
 *   GST           = sum of bill tax amounts
 *   Invoice total = sum of bill grand totals (incl. GST, rounded)
 *   Returns       = sum of sales-return grand totals dated in the period
 *   Net sales     = invoice total - returns   (incl. GST)
 */
const MAX_RANGE_DAYS = 366;
const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const n = (v) => Number(v || 0);

function dayBounds(dateStr) {
  const start = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(start.getTime())) throw new ApiError(400, 'Invalid date');
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function dateKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function resolveOutletIds(user, outletId) {
  const mayChoose = user.role === 'ADMIN';
  if (!mayChoose || !outletId) {
    if (!user.outletId) throw new ApiError(400, 'No outlet is assigned to your session');
    return [user.outletId];
  }
  if (outletId === 'all') {
    const outlets = await prisma.outlet.findMany({ where: { tenantId: user.tenantId }, select: { id: true } });
    return outlets.map((o) => o.id);
  }
  const outlet = await prisma.outlet.findFirst({ where: { id: outletId, tenantId: user.tenantId }, select: { id: true } });
  if (!outlet) throw new ApiError(404, 'Outlet not found');
  return [outlet.id];
}

export async function listNetSalesFilterOptions(user) {
  const mayChoose = user.role === 'ADMIN';
  const outlets = await prisma.outlet.findMany({
    where: { tenantId: user.tenantId, ...(mayChoose ? {} : { id: user.outletId || '' }) },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return { outlets, canChooseOutlet: mayChoose };
}

export async function getNetSalesReport(user, params = {}) {
  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  const from = params.from || dateKeyOf(weekAgo);
  const to = params.to || dateKeyOf(today);
  const { start } = dayBounds(from);
  const { end } = dayBounds(to);
  if (end < start) throw new ApiError(400, '"To" date cannot be before "From" date');
  if ((end - start) / 86400000 > MAX_RANGE_DAYS) throw new ApiError(400, `Date range cannot exceed ${MAX_RANGE_DAYS} days`);

  const outletIds = await resolveOutletIds(user, params.outletId);

  const salesByDay = await prisma.$queryRaw`
    SELECT to_char(s."CreateDate", 'YYYY-MM-DD') AS "day",
      COUNT(*)::int AS "bills",
      COALESCE(SUM(s."SubTotal"), 0) AS "gross",
      COALESCE(SUM(s."DiscountAmount"), 0) AS "discount",
      COALESCE(SUM(s."TaxAmount"), 0) AS "tax",
      COALESCE(SUM(s."GrandTotal"), 0) AS "total"
    FROM "Linesales" s
    WHERE s."TenantId" = ${user.tenantId} AND s."OutletId" = ANY(${outletIds})
      AND s."DocStatus" = 'COMPLETED'
      AND s."CreateDate" >= ${start} AND s."CreateDate" <= ${end}
    GROUP BY 1 ORDER BY 1`;

  const returnsByDay = await prisma.$queryRaw`
    SELECT to_char(r."CreatedAt", 'YYYY-MM-DD') AS "day", COALESCE(SUM(r."GrandTotal"), 0) AS "returns"
    FROM "SalesReturn" r
    JOIN "Linesales" s ON s."DocEntry" = r."DocEntry"
    WHERE r."TenantId" = ${user.tenantId} AND s."OutletId" = ANY(${outletIds})
      AND r."CreatedAt" >= ${start} AND r."CreatedAt" <= ${end}
    GROUP BY 1`;

  const byPayment = await prisma.$queryRaw`
    SELECT COALESCE(s."PayMode", 'unknown') AS "mode",
      COUNT(*)::int AS "bills", COALESCE(SUM(s."GrandTotal"), 0) AS "total"
    FROM "Linesales" s
    WHERE s."TenantId" = ${user.tenantId} AND s."OutletId" = ANY(${outletIds})
      AND s."DocStatus" = 'COMPLETED'
      AND s."CreateDate" >= ${start} AND s."CreateDate" <= ${end}
    GROUP BY 1 ORDER BY 3 DESC`;

  const returnsMap = new Map(returnsByDay.map((r) => [r.day, n(r.returns)]));
  const days = new Set([...salesByDay.map((d) => d.day), ...returnsMap.keys()]);
  const salesMap = new Map(salesByDay.map((d) => [d.day, d]));
  const daily = [...days].sort().map((day) => {
    const s = salesMap.get(day);
    const total = n(s?.total);
    const returns = returnsMap.get(day) || 0;
    return {
      day,
      bills: s?.bills || 0,
      gross: round2(s?.gross),
      discount: round2(s?.discount),
      tax: round2(s?.tax),
      total: round2(total),
      returns: round2(returns),
      netSales: round2(total - returns),
    };
  });

  const sum = (key) => round2(daily.reduce((acc, d) => acc + d[key], 0));
  const bills = daily.reduce((acc, d) => acc + d.bills, 0);
  const netSales = sum('netSales');

  return {
    from,
    to,
    summary: {
      bills,
      gross: sum('gross'),
      discount: sum('discount'),
      tax: sum('tax'),
      total: sum('total'),
      returns: sum('returns'),
      netSales,
      avgBill: bills > 0 ? round2(sum('total') / bills) : 0,
    },
    daily,
    byPayment: byPayment.map((p) => ({ mode: p.mode, bills: p.bills, total: round2(p.total) })),
    notes: {
      net: 'Net sales = invoice total (incl. GST) - sales returns dated in the period. Only completed bills are counted.',
    },
  };
}
