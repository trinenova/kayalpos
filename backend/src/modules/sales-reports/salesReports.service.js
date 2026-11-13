import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../middleware/errorHandler.js';

/**
 * Sales Reports (Reports > Sales Reports): Hourly Sales, Payment-wise
 * Sales, Discount Report, Tax Report and Return Report. Read-only, derived
 * from real Linesales (Sale)/LinesaleItemDetails/SalesReturn rows — same
 * convention as inventoryReports.service.js / cashierReports.service.js.
 */

const MAX_RANGE_DAYS = 366;

export const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const n = (v) => Number(v || 0);

function dayBounds(dateStr) {
  const start = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(start.getTime())) throw new ApiError(400, 'Invalid date');
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function dateKeyOf(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function resolveDateRange(from, to, defaultDays) {
  const to2 = to || dateKeyOf(new Date());
  const fromDefault = new Date();
  fromDefault.setDate(fromDefault.getDate() - (defaultDays - 1));
  const from2 = from || dateKeyOf(fromDefault);
  const { start } = dayBounds(from2);
  const { end } = dayBounds(to2);
  if (end < start) throw new ApiError(400, '"To" date cannot be before "From" date');
  if ((end - start) / 86400000 > MAX_RANGE_DAYS) throw new ApiError(400, `Date range cannot exceed ${MAX_RANGE_DAYS} days`);
  return {
    start, end, from: from2, to: to2,
  };
}

function paginate(rows, page = 1, pageSize = 20) {
  const totalPages = Math.max(Math.ceil(rows.length / pageSize), 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  return {
    rows: rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    total: rows.length,
    page: safePage,
    pageSize,
    totalPages,
  };
}

function matchesSearch(haystack, search) {
  if (!search) return true;
  return haystack.toLowerCase().includes(search.trim().toLowerCase());
}

// Only ADMIN may look across outlets; any other role stays on its own
// outlet — same rule shiftVariance.service.js's resolveOutletIds follows.
async function resolveOutletIds(user, outletId) {
  const mayChoose = user.role === 'ADMIN';
  if (!mayChoose || !outletId || outletId === 'all') {
    if (mayChoose && outletId === 'all') {
      const outlets = await prisma.outlet.findMany({ where: { tenantId: user.tenantId }, select: { id: true } });
      return outlets.map((o) => o.id);
    }
    if (!user.outletId) throw new ApiError(400, 'No outlet is assigned to your session');
    return [user.outletId];
  }
  const outlet = await prisma.outlet.findFirst({ where: { id: outletId, tenantId: user.tenantId }, select: { id: true } });
  if (!outlet) throw new ApiError(404, 'Outlet not found');
  return [outlet.id];
}

export async function listSalesReportFilters(user) {
  const mayChoose = user.role === 'ADMIN';
  const outlets = await prisma.outlet.findMany({
    where: { tenantId: user.tenantId, ...(mayChoose ? {} : { id: user.outletId || '' }) },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });
  return { outlets, canChooseOutlet: mayChoose };
}

// ---------------------------------------------------------------------------
// Hourly Sales — real Linesales rows in the range, bucketed by hour-of-day
// (server-local time, same convention as every other report's dayBounds) so
// the 24 rows show WHEN sales happen across a typical day, not one row per
// calendar day.
// ---------------------------------------------------------------------------

export async function getHourlySalesReport(user, query) {
  const range = resolveDateRange(query.from, query.to, 7);
  const tenantId = user.tenantId;
  const outletIds = await resolveOutletIds(user, query.outletId);

  const sales = await prisma.tczOpos.findMany({
    where: {
      tenantId, outletId: { in: outletIds }, docStatus: 'COMPLETED', createDate: { gte: range.start, lte: range.end },
    },
    select: { docEntry: true, createDate: true, grandTotal: true },
  });

  const qtyRows = await prisma.tczPos1.groupBy({
    by: ['docEntry'],
    where: {
      header: {
        tenantId, outletId: { in: outletIds }, docStatus: 'COMPLETED', createDate: { gte: range.start, lte: range.end },
      },
    },
    _sum: { quantity: true },
  });
  const qtyByDoc = new Map(qtyRows.map((r) => [String(r.docEntry), n(r._sum.quantity)]));

  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour, transactions: 0, quantity: 0, totalSales: 0,
  }));
  sales.forEach((s) => {
    const b = buckets[new Date(s.createDate).getHours()];
    b.transactions += 1;
    b.totalSales += n(s.grandTotal);
    b.quantity += qtyByDoc.get(String(s.docEntry)) || 0;
  });

  const rows = buckets
    .map((b) => ({
      id: b.hour,
      hourLabel: `${String(b.hour).padStart(2, '0')}:00 - ${String((b.hour + 1) % 24).padStart(2, '0')}:00`,
      transactions: b.transactions,
      quantity: b.quantity,
      totalSales: round2(b.totalSales),
      avgBillValue: b.transactions > 0 ? round2(b.totalSales / b.transactions) : 0,
    }))
    .filter((r) => matchesSearch(r.hourLabel, query.search));

  const peak = rows.reduce((max, r) => (max && max.totalSales >= r.totalSales ? max : r), null);
  const summary = {
    totalSales: round2(rows.reduce((s, r) => s + r.totalSales, 0)),
    totalTransactions: rows.reduce((s, r) => s + r.transactions, 0),
    peakHour: peak && peak.totalSales > 0 ? peak.hourLabel : '—',
    peakHourSales: peak ? peak.totalSales : 0,
  };
  return {
    range: { from: range.from, to: range.to }, summary, ...paginate(rows, query.page, query.pageSize),
  };
}

// Drill-down for Hourly Sales: every item sold within one hour-of-day
// bucket, across the same date range/outlet as the parent report. Real
// LinesaleItemDetails rows, grouped by item (itemCode falls back to
// itemName when a line was saved without one — same "never drop a row for
// a missing key" rule the inventory movement ledger follows).
export async function getHourlySalesItems(user, hour, query) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new ApiError(400, 'Invalid hour');
  const range = resolveDateRange(query.from, query.to, 7);
  const tenantId = user.tenantId;
  const outletIds = await resolveOutletIds(user, query.outletId);

  const lines = await prisma.tczPos1.findMany({
    where: {
      header: {
        tenantId, outletId: { in: outletIds }, docStatus: 'COMPLETED', createDate: { gte: range.start, lte: range.end },
      },
    },
    select: {
      itemCode: true, itemName: true, quantity: true, lineTotal: true, header: { select: { createDate: true } },
    },
  });

  const byItem = new Map();
  lines
    .filter((l) => new Date(l.header.createDate).getHours() === hour)
    .forEach((l) => {
      const key = l.itemCode || l.itemName || 'unknown';
      const entry = byItem.get(key) || {
        itemCode: l.itemCode || '—', itemName: l.itemName || 'Unknown Item', qty: 0, salesValue: 0,
      };
      entry.qty += n(l.quantity);
      entry.salesValue += n(l.lineTotal);
      byItem.set(key, entry);
    });

  const rows = [...byItem.values()]
    .map((e) => ({
      id: `${e.itemCode}-${e.itemName}`, itemCode: e.itemCode, itemName: e.itemName, qty: round2(e.qty), salesValue: round2(e.salesValue),
    }))
    .filter((r) => matchesSearch(`${r.itemCode} ${r.itemName}`, query.search))
    .sort((a, b) => b.salesValue - a.salesValue);

  return {
    hour,
    hourLabel: `${String(hour).padStart(2, '0')}:00 - ${String((hour + 1) % 24).padStart(2, '0')}:00`,
    range: { from: range.from, to: range.to },
    rows,
    total: rows.length,
  };
}

// ---------------------------------------------------------------------------
// Payment-wise Sales — real Linesales rows in the range, grouped by tender
// (Sale.payMode).
// ---------------------------------------------------------------------------

export async function getPaymentWiseSalesReport(user, query) {
  const range = resolveDateRange(query.from, query.to, 30);
  const tenantId = user.tenantId;
  const outletIds = await resolveOutletIds(user, query.outletId);

  const grouped = await prisma.tczOpos.groupBy({
    by: ['payMode'],
    where: {
      tenantId, outletId: { in: outletIds }, docStatus: 'COMPLETED', createDate: { gte: range.start, lte: range.end },
    },
    _sum: { grandTotal: true },
    _count: { _all: true },
  });

  const totalSales = round2(grouped.reduce((s, g) => s + n(g._sum.grandTotal), 0));
  const rows = grouped
    .map((g) => {
      const sales = round2(g._sum.grandTotal);
      return {
        id: g.payMode || 'unknown',
        paymentMode: g.payMode || 'Unknown',
        transactions: g._count._all,
        totalSales: sales,
        contributionPercent: totalSales > 0 ? round2((sales / totalSales) * 100) : 0,
        avgBillValue: g._count._all > 0 ? round2(sales / g._count._all) : 0,
      };
    })
    .filter((r) => matchesSearch(r.paymentMode, query.search))
    .sort((a, b) => b.totalSales - a.totalSales);

  const summary = {
    totalSales,
    totalTransactions: rows.reduce((s, r) => s + r.transactions, 0),
    paymentModes: rows.length,
  };
  return {
    range: { from: range.from, to: range.to }, summary, ...paginate(rows, query.page, query.pageSize),
  };
}

// ---------------------------------------------------------------------------
// Discount Report — real Linesales rows in the range with a real discount
// (Sale.discountAmount > 0), one row per bill.
// ---------------------------------------------------------------------------

export async function getDiscountReport(user, query) {
  const range = resolveDateRange(query.from, query.to, 30);
  const tenantId = user.tenantId;
  const outletIds = await resolveOutletIds(user, query.outletId);

  const sales = await prisma.tczOpos.findMany({
    where: {
      tenantId, outletId: { in: outletIds }, docStatus: 'COMPLETED', createDate: { gte: range.start, lte: range.end }, discountAmount: { gt: 0 },
    },
    orderBy: { createDate: 'desc' },
    select: {
      docEntry: true, docNum: true, createDate: true, createdBy: true, customerName: true, subTotal: true, discountAmount: true, grandTotal: true,
    },
  });

  const rows = sales
    .map((s) => ({
      id: String(s.docEntry),
      billNo: s.docNum,
      date: s.createDate,
      cashierName: s.createdBy,
      customerName: s.customerName,
      subTotal: round2(s.subTotal),
      discountAmount: round2(s.discountAmount),
      grandTotal: round2(s.grandTotal),
      discountPercent: n(s.subTotal) > 0 ? round2((n(s.discountAmount) / n(s.subTotal)) * 100) : 0,
    }))
    .filter((r) => matchesSearch(`${r.billNo} ${r.cashierName} ${r.customerName}`, query.search));

  const summary = {
    totalBills: rows.length,
    totalDiscount: round2(rows.reduce((s, r) => s + r.discountAmount, 0)),
    avgDiscountPercent: rows.length ? round2(rows.reduce((s, r) => s + r.discountPercent, 0) / rows.length) : 0,
  };
  return {
    range: { from: range.from, to: range.to }, summary, ...paginate(rows, query.page, query.pageSize),
  };
}

// ---------------------------------------------------------------------------
// Tax Report — real LinesaleItemDetails rows in the range, grouped by the
// tax code applied on each line (TczPos1.taxCode).
// ---------------------------------------------------------------------------

export async function getTaxReport(user, query) {
  const range = resolveDateRange(query.from, query.to, 30);
  const tenantId = user.tenantId;
  const outletIds = await resolveOutletIds(user, query.outletId);

  const grouped = await prisma.tczPos1.groupBy({
    by: ['taxCode'],
    where: {
      header: {
        tenantId, outletId: { in: outletIds }, docStatus: 'COMPLETED', createDate: { gte: range.start, lte: range.end },
      },
    },
    _sum: { taxableValue: true, taxValue: true, lineTotal: true },
  });

  const rows = grouped
    .map((g) => {
      const taxable = n(g._sum.taxableValue);
      const taxCollected = n(g._sum.taxValue);
      return {
        id: g.taxCode || 'none',
        taxCode: g.taxCode || 'Unspecified',
        taxableValue: round2(taxable),
        taxCollected: round2(taxCollected),
        effectiveRate: taxable > 0 ? round2((taxCollected / taxable) * 100) : 0,
        netSales: round2(g._sum.lineTotal),
      };
    })
    .filter((r) => matchesSearch(r.taxCode, query.search))
    .sort((a, b) => b.taxCollected - a.taxCollected);

  const summary = {
    taxCodes: rows.length,
    totalTaxableValue: round2(rows.reduce((s, r) => s + r.taxableValue, 0)),
    totalTaxCollected: round2(rows.reduce((s, r) => s + r.taxCollected, 0)),
  };
  return {
    range: { from: range.from, to: range.to }, summary, ...paginate(rows, query.page, query.pageSize),
  };
}

// ---------------------------------------------------------------------------
// Return Report — real SalesReturn rows in the range.
// ---------------------------------------------------------------------------

export async function getReturnReport(user, query) {
  const range = resolveDateRange(query.from, query.to, 30);
  const tenantId = user.tenantId;
  const outletIds = await resolveOutletIds(user, query.outletId);

  const returns = await prisma.salesReturn.findMany({
    where: {
      tenantId, createdAt: { gte: range.start, lte: range.end }, tczBill: { outletId: { in: outletIds } },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      returnNo: true,
      createdAt: true,
      customerName: true,
      cashierName: true,
      reason: true,
      refundMode: true,
      refundTo: true,
      subTotal: true,
      discountAmount: true,
      taxAmount: true,
      grandTotal: true,
      tczBill: { select: { docNum: true } },
    },
  });

  const rows = returns
    .map((r) => ({
      id: r.id,
      returnNo: r.returnNo,
      date: r.createdAt,
      originalBillNo: r.tczBill?.docNum || '—',
      customerName: r.customerName,
      cashierName: r.cashierName,
      reason: r.reason,
      refundMode: r.refundMode,
      refundTo: r.refundTo || '—',
      subTotal: round2(r.subTotal),
      discountAmount: round2(r.discountAmount),
      taxAmount: round2(r.taxAmount),
      grandTotal: round2(r.grandTotal),
    }))
    .filter((r) => matchesSearch(`${r.returnNo} ${r.originalBillNo} ${r.customerName} ${r.cashierName} ${r.reason}`, query.search));

  const summary = {
    totalReturns: rows.length,
    totalRefundAmount: round2(rows.reduce((s, r) => s + r.grandTotal, 0)),
    avgReturnValue: rows.length ? round2(rows.reduce((s, r) => s + r.grandTotal, 0) / rows.length) : 0,
  };
  return {
    range: { from: range.from, to: range.to }, summary, ...paginate(rows, query.page, query.pageSize),
  };
}
