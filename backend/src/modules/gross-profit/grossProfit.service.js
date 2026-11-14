import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { outletIdFilter, outletAnd, outletFieldFilter } from '../../utils/outletScope.js';

/**
 * Gross Profit report (Reports > Financial Reports > Gross Profit).
 * Read-only, derived from existing rows:
 *   Net sales    = sum of each COMPLETED Linesales line's taxable value (sales excl. GST,
 *                  after discount). Falls back to LineTotal - TaxValue when TaxableValue is 0.
 *   Cost         = per line, quantity x the purchase price of the FIFO lot it was sold
 *                  from (frozen on the line); older lines without one fall back to the
 *                  product's latest SellingPrice.purchaseCost.
 *   Gross profit = net sales - cost; margin % = gross profit / net sales.
 * Products with no purchase cost on file count as cost 0 and are flagged (noCost)
 * so the figure is never silently overstated. Sales returns are not netted off yet.
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
    const outlets = await prisma.outlet.findMany({ where: { tenantId: user.tenantId, ...outletIdFilter(user) }, select: { id: true } });
    return outlets.map((o) => o.id);
  }
  const outlet = await prisma.outlet.findFirst({ where: { id: outletId, tenantId: user.tenantId, ...outletAnd(user) }, select: { id: true } });
  if (!outlet) throw new ApiError(404, 'Outlet not found');
  return [outlet.id];
}

export async function listGrossProfitFilterOptions(user) {
  const mayChoose = user.role === 'ADMIN';
  const outlets = await prisma.outlet.findMany({
    where: { tenantId: user.tenantId, ...(mayChoose ? outletIdFilter(user) : { id: user.outletId || '' }) },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return { outlets, canChooseOutlet: mayChoose };
}

export async function getGrossProfitReport(user, params = {}) {
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

  const lines = await prisma.$queryRaw`
    SELECT l."ProductId" AS "productId",
      COALESCE(MAX(l."ItemCode"), '') AS "code",
      COALESCE(MAX(l."ItemName"), '') AS "name",
      SUM(l."Quantity") AS "qty",
      SUM(CASE WHEN COALESCE(l."TaxableValue", 0) > 0 THEN l."TaxableValue"
               ELSE COALESCE(l."LineTotal", 0) - COALESCE(l."TaxValue", 0) END) AS "netSales",
      SUM(l."Quantity" * COALESCE(l."UnitCost", c."PurchaseCost", 0)) AS "cost",
      BOOL_OR(l."UnitCost" IS NULL AND COALESCE(c."PurchaseCost", 0) = 0) AS "noCost"
    FROM "Linesales" s
    JOIN "LinesaleItemDetails" l ON l."DocEntry" = s."DocEntry"
    LEFT JOIN (
      SELECT DISTINCT ON ("ProductId") "ProductId", "PurchaseCost"
      FROM "SellingPrice" WHERE "TenantId" = ${user.tenantId}
      ORDER BY "ProductId", "UpdatedAt" DESC
    ) c ON c."ProductId" = l."ProductId"
    WHERE s."TenantId" = ${user.tenantId} AND s."OutletId" = ANY(${outletIds})
      AND s."DocStatus" = 'COMPLETED'
      AND s."CreateDate" >= ${start} AND s."CreateDate" <= ${end}
    GROUP BY l."ProductId"
    ORDER BY SUM(l."LineTotal") DESC NULLS LAST
    LIMIT 1000`;

  const daily = await prisma.$queryRaw`
    SELECT to_char(s."CreateDate", 'YYYY-MM-DD') AS "day",
      SUM(CASE WHEN COALESCE(l."TaxableValue", 0) > 0 THEN l."TaxableValue"
               ELSE COALESCE(l."LineTotal", 0) - COALESCE(l."TaxValue", 0) END) AS "netSales",
      SUM(l."Quantity" * COALESCE(l."UnitCost", c."PurchaseCost", 0)) AS "cost"
    FROM "Linesales" s
    JOIN "LinesaleItemDetails" l ON l."DocEntry" = s."DocEntry"
    LEFT JOIN (
      SELECT DISTINCT ON ("ProductId") "ProductId", "PurchaseCost"
      FROM "SellingPrice" WHERE "TenantId" = ${user.tenantId}
      ORDER BY "ProductId", "UpdatedAt" DESC
    ) c ON c."ProductId" = l."ProductId"
    WHERE s."TenantId" = ${user.tenantId} AND s."OutletId" = ANY(${outletIds})
      AND s."DocStatus" = 'COMPLETED'
      AND s."CreateDate" >= ${start} AND s."CreateDate" <= ${end}
    GROUP BY 1 ORDER BY 1`;

  const rows = lines.map((r) => {
    const qty = n(r.qty);
    const netSales = round2(r.netSales);
    const cost = round2(r.cost);
    const grossProfit = round2(netSales - cost);
    return {
      productId: r.productId,
      code: r.code,
      name: r.name,
      qty: Math.round(qty * 1000) / 1000,
      netSales,
      unitCost: qty > 0 ? round2(cost / qty) : 0,
      cost,
      grossProfit,
      marginPct: netSales > 0 ? round2((grossProfit / netSales) * 100) : 0,
      noCost: Boolean(r.noCost),
    };
  });

  const netSales = round2(rows.reduce((s, r) => s + r.netSales, 0));
  const cost = round2(rows.reduce((s, r) => s + r.cost, 0));
  const grossProfit = round2(netSales - cost);

  return {
    from,
    to,
    summary: {
      netSales,
      cost,
      grossProfit,
      marginPct: netSales > 0 ? round2((grossProfit / netSales) * 100) : 0,
      itemsSold: round2(rows.reduce((s, r) => s + r.qty, 0)),
      productsWithoutCost: rows.filter((r) => r.noCost).length,
    },
    trend: daily.map((d) => ({
      day: d.day,
      netSales: round2(d.netSales),
      cost: round2(d.cost),
      grossProfit: round2(n(d.netSales) - n(d.cost)),
    })),
    rows,
    notes: {
      cost: 'Cost = quantity sold x the purchase price of the batch (FIFO lot) it was sold from; older bills use the latest purchase cost from Selling Price. Lines with no cost on file count as 0.',
      returns: 'Sales returns are not deducted.',
    },
  };
}
