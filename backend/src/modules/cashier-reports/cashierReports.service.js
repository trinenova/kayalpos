import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { outletIdFilter, outletAnd, outletFieldFilter } from '../../utils/outletScope.js';

/**
 * Cashier Reports (Reports > Cashier Reports): Cashier Sales, Cash
 * Collection and Cash Shortage/Excess. Read-only, derived from real
 * Linesales (Sale)/LinesaleItemDetails/SalesReturn/ShiftSession rows — same
 * convention as shiftVariance.service.js and shortageExcess.service.js,
 * just scoped to a date RANGE (with pagination) instead of a single day, to
 * match every other report under Reports > *.
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
      const outlets = await prisma.outlet.findMany({ where: { tenantId: user.tenantId, ...outletIdFilter(user) }, select: { id: true } });
      return outlets.map((o) => o.id);
    }
    if (!user.outletId) throw new ApiError(400, 'No outlet is assigned to your session');
    return [user.outletId];
  }
  const outlet = await prisma.outlet.findFirst({ where: { id: outletId, tenantId: user.tenantId, ...outletAnd(user) }, select: { id: true } });
  if (!outlet) throw new ApiError(404, 'Outlet not found');
  return [outlet.id];
}

export async function listCashierReportFilters(user) {
  const mayChoose = user.role === 'ADMIN';
  const outlets = await prisma.outlet.findMany({
    where: { tenantId: user.tenantId, ...(mayChoose ? outletIdFilter(user) : { id: user.outletId || '' }) },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });
  const cashiers = await prisma.shiftSession.findMany({
    where: { tenantId: user.tenantId, ...(mayChoose ? outletFieldFilter(user) : { outletId: user.outletId || '' }) },
    select: { cashierId: true, cashierName: true },
    distinct: ['cashierId'],
    orderBy: { cashierName: 'asc' },
  });
  return { outlets, cashiers: cashiers.map((c) => ({ id: c.cashierId, name: c.cashierName })), canChooseOutlet: mayChoose };
}

// A Sale (Linesales) row only carries `createdBy` (the cashier's display
// name) — there is no cashierId FK on it, unlike ShiftSession. To let the
// Cashier Sales report filter by the same cashierId dropdown every other
// cashier report uses, this resolves the selected cashierId to the name
// Sale rows actually carry, via ShiftSession (the one real cashierId->name
// mapping that exists in this schema).
async function cashierNameFor(user, cashierId) {
  if (!cashierId) return undefined;
  const shift = await prisma.shiftSession.findFirst({
    where: { tenantId: user.tenantId, cashierId }, select: { cashierName: true },
  });
  if (!shift) throw new ApiError(404, 'Cashier not found');
  return shift.cashierName;
}

// ---------------------------------------------------------------------------
// Cashier Sales — real Linesales/LinesaleItemDetails/SalesReturn rows,
// grouped by cashier (Sale.createdBy), over the selected date range.
// ---------------------------------------------------------------------------

export async function getCashierSalesReport(user, query) {
  const range = resolveDateRange(query.from, query.to, 30);
  const tenantId = user.tenantId;
  const outletIds = await resolveOutletIds(user, query.outletId);
  const cashierName = await cashierNameFor(user, query.cashierId);

  const sales = await prisma.tczOpos.findMany({
    where: {
      tenantId, outletId: { in: outletIds }, docStatus: 'COMPLETED', createDate: { gte: range.start, lte: range.end },
    },
    select: {
      docEntry: true, createdBy: true, grandTotal: true, discountAmount: true, taxAmount: true,
    },
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

  const returns = await prisma.salesReturn.findMany({
    where: {
      tenantId, refundMode: 'refund', createdAt: { gte: range.start, lte: range.end }, tczBill: { outletId: { in: outletIds } },
    },
    select: { cashierName: true, grandTotal: true },
  });

  const byCashier = new Map();
  const entryFor = (name) => {
    const key = name || 'Unassigned';
    if (!byCashier.has(key)) {
      byCashier.set(key, {
        cashierName: key, totalSales: 0, transactions: 0, quantity: 0, discount: 0, tax: 0, returns: 0,
      });
    }
    return byCashier.get(key);
  };

  sales.forEach((s) => {
    const entry = entryFor(s.createdBy);
    entry.totalSales += n(s.grandTotal);
    entry.transactions += 1;
    entry.quantity += qtyByDoc.get(String(s.docEntry)) || 0;
    entry.discount += n(s.discountAmount);
    entry.tax += n(s.taxAmount);
  });
  returns.forEach((r) => { entryFor(r.cashierName).returns += n(r.grandTotal); });

  let rows = [...byCashier.values()]
    .map((e) => ({
      cashierName: e.cashierName,
      totalSales: round2(e.totalSales),
      transactions: e.transactions,
      quantity: e.quantity,
      discount: round2(e.discount),
      tax: round2(e.tax),
      returns: round2(e.returns),
      netSales: round2(e.totalSales - e.returns),
      avgInvoiceValue: e.transactions > 0 ? round2(e.totalSales / e.transactions) : 0,
    }))
    .filter((r) => matchesSearch(r.cashierName, query.search));

  if (cashierName) rows = rows.filter((r) => r.cashierName === cashierName);
  rows.sort((a, b) => b.totalSales - a.totalSales);
  rows = rows.map((r, i) => ({ id: `${i}-${r.cashierName}`, ...r }));

  const summary = {
    totalCashiers: rows.length,
    totalSales: round2(rows.reduce((s, r) => s + r.totalSales, 0)),
    totalTransactions: rows.reduce((s, r) => s + r.transactions, 0),
    netSales: round2(rows.reduce((s, r) => s + r.netSales, 0)),
  };
  return {
    range: { from: range.from, to: range.to }, summary, ...paginate(rows, query.page, query.pageSize),
  };
}

// ---------------------------------------------------------------------------
// Payment Collection — real Linesales (Sale) + SalesReturn rows in the
// range, grouped by cashier (Sale.createdBy — same join Cashier Sales uses,
// since a Sale carries no shift FK) and broken out by tender (cash net of
// change, card, UPI). Any other tender (wallet, store credit, cheque, bank
// transfer, plain "credit") folds into `otherCollected`/`otherRefunds`
// rather than a 4th column, since the user only asked to split out
// Cash/UPI/Card — but it still counts toward the Total so no money
// silently disappears from the report.
//
// Deliberately NOT built from ShiftSession (unlike an earlier version of
// this report): sales can be recorded with no open shift in this schema,
// so a shift-based report showed zero collection even when Cashier Sales,
// built from the same Sale rows, showed real data for the same cashier.
// ---------------------------------------------------------------------------

export async function getPaymentCollectionReport(user, query) {
  const range = resolveDateRange(query.from, query.to, 30);
  const tenantId = user.tenantId;
  const outletIds = await resolveOutletIds(user, query.outletId);
  const cashierName = await cashierNameFor(user, query.cashierId);

  // Per cashier+tender sums. changeAmount is never negative in practice, so
  // SUM(received) - SUM(changeAmount) over a group equals SUM(received -
  // changeAmount) per row — the same "cash the drawer actually keeps" figure
  // shiftVariance.service.js computes per row, without needing raw SQL here.
  const grouped = await prisma.tczOpos.groupBy({
    by: ['createdBy', 'payMode'],
    where: {
      tenantId, outletId: { in: outletIds }, docStatus: 'COMPLETED', createDate: { gte: range.start, lte: range.end },
    },
    _sum: { grandTotal: true, received: true, changeAmount: true },
    _count: { _all: true },
  });

  const refundGrouped = await prisma.salesReturn.groupBy({
    by: ['cashierName', 'refundTo'],
    where: {
      tenantId, refundMode: 'refund', createdAt: { gte: range.start, lte: range.end }, tczBill: { outletId: { in: outletIds } },
    },
    _sum: { grandTotal: true },
  });

  const byCashier = new Map();
  const entryFor = (name) => {
    const key = name || 'Unassigned';
    if (!byCashier.has(key)) {
      byCashier.set(key, {
        cashierName: key, transactions: 0, cashCollected: 0, cardCollected: 0, upiCollected: 0, otherCollected: 0, cashRefunds: 0, cardRefunds: 0, upiRefunds: 0, otherRefunds: 0,
      });
    }
    return byCashier.get(key);
  };

  grouped.forEach((g) => {
    const entry = entryFor(g.createdBy);
    entry.transactions += g._count._all;
    if (g.payMode === 'cash') entry.cashCollected += n(g._sum.received) - n(g._sum.changeAmount);
    else if (g.payMode === 'card') entry.cardCollected += n(g._sum.grandTotal);
    else if (g.payMode === 'upi') entry.upiCollected += n(g._sum.grandTotal);
    else entry.otherCollected += n(g._sum.grandTotal);
  });
  refundGrouped.forEach((g) => {
    const entry = entryFor(g.cashierName);
    if (g.refundTo === 'cash') entry.cashRefunds += n(g._sum.grandTotal);
    else if (g.refundTo === 'card') entry.cardRefunds += n(g._sum.grandTotal);
    else if (g.refundTo === 'upi') entry.upiRefunds += n(g._sum.grandTotal);
    else entry.otherRefunds += n(g._sum.grandTotal);
  });

  let rows = [...byCashier.values()].map((c) => {
    const totalCollected = round2(c.cashCollected + c.cardCollected + c.upiCollected + c.otherCollected);
    const totalRefunds = round2(c.cashRefunds + c.cardRefunds + c.upiRefunds + c.otherRefunds);
    return {
      id: c.cashierName,
      cashierName: c.cashierName,
      transactions: c.transactions,
      cashCollected: round2(c.cashCollected),
      cardCollected: round2(c.cardCollected),
      upiCollected: round2(c.upiCollected),
      otherCollected: round2(c.otherCollected),
      totalCollected,
      totalRefunds,
      netCollected: round2(totalCollected - totalRefunds),
    };
  }).filter((r) => matchesSearch(r.cashierName, query.search));

  if (cashierName) rows = rows.filter((r) => r.cashierName === cashierName);
  rows.sort((a, b) => b.totalCollected - a.totalCollected);

  const summary = {
    totalCashiers: rows.length,
    totalCash: round2(rows.reduce((s, r) => s + r.cashCollected, 0)),
    totalCard: round2(rows.reduce((s, r) => s + r.cardCollected, 0)),
    totalUpi: round2(rows.reduce((s, r) => s + r.upiCollected, 0)),
    totalCollected: round2(rows.reduce((s, r) => s + r.totalCollected, 0)),
    netCollected: round2(rows.reduce((s, r) => s + r.netCollected, 0)),
  };
  return {
    range: { from: range.from, to: range.to }, summary, ...paginate(rows, query.page, query.pageSize),
  };
}

// ---------------------------------------------------------------------------
// Cash Shortage/Excess — real ShiftSession.closingVariance rows in the
// range (the same real figure shortageExcess.service.js's single-day
// Cashier Panel report reads, computed once at closeShift() time — see that
// field's own doc comment). A zero variance is an exact match, never a
// shortage or an excess, so it never appears on this report.
// ---------------------------------------------------------------------------

export async function getCashShortageExcessReport(user, query) {
  const range = resolveDateRange(query.from, query.to, 30);
  const tenantId = user.tenantId;
  const outletIds = await resolveOutletIds(user, query.outletId);

  const where = {
    tenantId, outletId: { in: outletIds }, status: 'CLOSED', closedAt: { gte: range.start, lte: range.end }, ...(query.cashierId ? { cashierId: query.cashierId } : {}),
  };

  const shifts = await prisma.shiftSession.findMany({
    where, orderBy: { closedAt: 'desc' }, include: { outlet: { select: { name: true } } },
  });

  const rows = shifts
    .filter((s) => s.closingVariance != null && n(s.closingVariance) !== 0)
    .map((s) => {
      const variance = n(s.closingVariance);
      return {
        id: s.id,
        shiftNo: s.shiftNo,
        outletName: s.outlet?.name || '',
        cashierName: s.cashierName,
        closedAt: s.closedAt,
        type: variance < 0 ? 'SHORTAGE' : 'EXCESS',
        amount: round2(Math.abs(variance)),
        expectedClosingCash: s.expectedClosingCash == null ? null : round2(s.expectedClosingCash),
        actualClosingCash: s.closingCash == null ? null : round2(s.closingCash),
        remarks: s.closingRemarks || '—',
      };
    })
    .filter((r) => matchesSearch(`${r.cashierName} ${r.shiftNo} ${r.outletName}`, query.search));

  const totalShortage = round2(rows.filter((r) => r.type === 'SHORTAGE').reduce((s, r) => s + r.amount, 0));
  const totalExcess = round2(rows.filter((r) => r.type === 'EXCESS').reduce((s, r) => s + r.amount, 0));
  const summary = {
    totalEntries: rows.length,
    totalShortage,
    totalExcess,
    netAmount: round2(totalShortage - totalExcess),
  };
  return {
    range: { from: range.from, to: range.to }, summary, ...paginate(rows, query.page, query.pageSize),
  };
}
