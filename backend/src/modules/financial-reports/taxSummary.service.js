import { prisma } from '../../config/prisma.js';
import {
  resolveRange, resolveOutletIds, round2, n,
} from './common.js';

/**
 * Tax Summary: GST collected on completed bills, by tax rate (with the
 * CGST/SGST split) and by day, less the GST on sales returns, compared with the
 * GST paid on stock receipts marked received in the period (input tax).
 *   Net tax payable = output tax - tax on returns - input tax.
 */
export async function getTaxSummaryReport(user, params) {
  const { from, to, start, end } = resolveRange(params);
  const outletIds = await resolveOutletIds(user, params.outletId);

  const byRate = await prisma.$queryRaw`
    SELECT COALESCE(l."TaxRate", 0) AS "rate",
      SUM(COALESCE(l."TaxableValue", 0)) AS "taxable",
      SUM(COALESCE(l."TaxValue", 0)) AS "tax"
    FROM "Linesales" s
    JOIN "LinesaleItemDetails" l ON l."DocEntry" = s."DocEntry"
    WHERE s."TenantId" = ${user.tenantId} AND s."OutletId" = ANY(${outletIds})
      AND s."DocStatus" = 'COMPLETED' AND s."CreateDate" >= ${start} AND s."CreateDate" <= ${end}
    GROUP BY 1 ORDER BY 1`;

  const daily = await prisma.$queryRaw`
    SELECT to_char(s."CreateDate", 'YYYY-MM-DD') AS "day", COUNT(*)::int AS "bills",
      COALESCE(SUM(s."TaxableValue"), 0) AS "taxable", COALESCE(SUM(s."TaxAmount"), 0) AS "tax"
    FROM "Linesales" s
    WHERE s."TenantId" = ${user.tenantId} AND s."OutletId" = ANY(${outletIds})
      AND s."DocStatus" = 'COMPLETED' AND s."CreateDate" >= ${start} AND s."CreateDate" <= ${end}
    GROUP BY 1 ORDER BY 1`;

  const [returnsRow] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(r."TaxAmount"), 0) AS "tax", COALESCE(SUM(r."SubTotal" - r."DiscountAmount"), 0) AS "taxable"
    FROM "SalesReturn" r JOIN "Linesales" s ON s."DocEntry" = r."DocEntry"
    WHERE r."TenantId" = ${user.tenantId} AND s."OutletId" = ANY(${outletIds})
      AND r."CreatedAt" >= ${start} AND r."CreatedAt" <= ${end}`;

  const input = await prisma.stockReceipt.aggregate({
    where: { tenantId: user.tenantId, status: 'received', fromOutletId: { in: outletIds }, receivedOn: { gte: start, lte: end } },
    _sum: { totalTax: true, totalEstimatedValue: true },
    _count: true,
  });

  const rates = byRate.map((r) => {
    const tax = round2(r.tax);
    return {
      ratePct: round2(n(r.rate) * 100), taxable: round2(r.taxable), tax, cgst: round2(tax / 2), sgst: round2(tax / 2),
    };
  });
  const outputTax = round2(rates.reduce((s, r) => s + r.tax, 0));
  const taxableSales = round2(rates.reduce((s, r) => s + r.taxable, 0));
  const returnsTax = round2(returnsRow?.tax);
  const inputTax = round2(input._sum.totalTax);

  return {
    from,
    to,
    summary: {
      taxableSales,
      outputTax,
      returnsTax,
      inputTax,
      netTaxPayable: round2(outputTax - returnsTax - inputTax),
      receiptsCount: input._count,
    },
    byRate: rates,
    daily: daily.map((d) => ({
      day: d.day, bills: d.bills, taxable: round2(d.taxable), tax: round2(d.tax),
    })),
    notes: {
      basis: 'Output tax = GST on completed bills; returns reduce it. Input tax = GST on stock receipts received in the period. CGST/SGST are an equal split of the GST (intra-state). Net tax payable is an estimate, not a GST return.',
    },
  };
}
