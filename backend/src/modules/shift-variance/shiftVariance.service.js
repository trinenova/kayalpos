import { asSale } from '../sale/tczSaleView.js';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { outletIdFilter, outletAnd, outletFieldFilter } from '../../utils/outletScope.js';

/**
 * Shift-to-Shift Variance Report.
 *
 * There is no table of its own — every figure is derived from existing rows:
 *   ShiftSession          opening/closing counts, cashier, window (openedAt..closedAt)
 *   Linesales              tender totals (a bill belongs to the shift whose window contains
 *                         its CreateDate at the same outlet — a bill has no shift FK)
 *   SalesReturn           refunds (refundMode='refund', refundTo = cash/card/upi)
 *   CashWithdrawal / CashDeposit / CashTransfer   cash leaving the drawer (FK to the shift)
 *
 * FIELD MEANINGS (confirmed from the schema + sale.service.js):
 *   Linesales.Received     = tender handed over by the customer;
 *   Linesales.ChangeAmount = Received − GrandTotal (change handed back);
 *   so the cash the drawer actually KEEPS from a cash sale is
 *   receivedAmount − max(changeAmount, 0)  (= grandTotal when fully paid).
 *
 * CALCULATIONS (sign convention: + excess, − shortage)
 *   expectedClosingCash = openingCash + cashSales(net of change) + cashPaidIn(0 — no such txn type exists)
 *                         − cashRefunds − withdrawals − deposits − transfers
 *   closingVariance     = actualClosingCash − expectedClosingCash
 *   handoverVariance    = acknowledged − declared, where
 *       declared      = this shift's counted closingCash
 *       acknowledged  = the NEXT shift's counted openingCash (same outlet, next by openedAt)
 *   The two variances are reported separately; a shortage is never folded into the next
 *   shift's opening balance.
 *
 * NOT IN THE EXISTING SCHEMA (reported honestly, not invented): registers/tills (a shift
 * is per outlet, one open at a time), a separate handover declaration/acknowledgement
 * step, variance approval/adjustment, and card/UPI settlement reconciliation.
 *
 * Time zone: like every other cashier report, "business date" and the from/to filter use
 * the server's local calendar day of the shift's openedAt; a shift that crosses midnight
 * belongs to the day it OPENED.
 */

const MAX_RANGE_DAYS = 93;
const MAX_SHIFTS = 5000;

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

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return { from: dateKeyOf(from), to: dateKeyOf(to) };
}

/** Pure: classify the closing variance of one shift. */
export function closingStatusOf(shift, closingVariance) {
  if (shift.status !== 'CLOSED') return 'OPEN';
  if (shift.closingCash == null) return 'MISSING_COUNT';
  if (closingVariance < 0) return 'SHORT';
  if (closingVariance > 0) return 'EXCESS';
  return 'BALANCED';
}

/** Pure: classify the handover from this shift to the next. */
export function handoverOf(shift, next) {
  const declared = shift.closingCash == null ? null : round2(shift.closingCash);
  if (shift.status !== 'CLOSED') return { declared, acknowledged: null, variance: null, status: 'NOT_CLOSED' };
  if (declared == null) return { declared, acknowledged: null, variance: null, status: 'MISSING_COUNT' };
  if (!next) return { declared, acknowledged: null, variance: null, status: 'PENDING' };
  const acknowledged = round2(next.openingCash);
  const variance = round2(acknowledged - declared);
  let status = 'MATCHED';
  if (variance < 0) status = 'SHORT';
  else if (variance > 0) status = 'EXCESS';
  return { declared, acknowledged, variance, status };
}

/** Pure: expected closing cash from the component figures. */
export function expectedClosingCashOf({
  openingCash, cashSales, cashPaidIn = 0, cashRefunds, withdrawals, deposits, transfers,
}) {
  return round2(n(openingCash) + n(cashSales) + n(cashPaidIn) - n(cashRefunds) - n(withdrawals) - n(deposits) - n(transfers));
}

function matchesStatus(row, status) {
  const c = row.closingStatus;
  const h = row.handover.status;
  switch (status) {
    case 'shortage': return c === 'SHORT' || h === 'SHORT';
    case 'excess': return c === 'EXCESS' || h === 'EXCESS';
    case 'balanced': return c === 'BALANCED' && h === 'MATCHED';
    case 'pending': return h === 'PENDING' || c === 'OPEN';
    case 'missing': return c === 'MISSING_COUNT';
    case 'unresolved': return row.hasUnresolvedVariance;
    default: return true;
  }
}

async function resolveOutletIds(user, outletId) {
  // Only ADMIN exists today; any other role stays on its own outlet.
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

export async function listVarianceFilterOptions(user) {
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

// One grouped query per source, joined to each shift's own window. Shift windows at
// one outlet never overlap (only one shift may be OPEN per outlet), so a transaction
// can belong to at most one shift — nothing is counted twice.
async function aggregateShifts(tenantId, shiftIds) {
  const salesRows = await prisma.$queryRaw`
    SELECT sh."Id" AS "shiftId",
      COALESCE(SUM(CASE WHEN s."PayMode" = 'cash' THEN s."Received" - GREATEST(s."ChangeAmount", 0) END), 0) AS "cashSales",
      COUNT(CASE WHEN s."PayMode" = 'cash' THEN 1 END)::int AS "cashCount",
      COALESCE(SUM(CASE WHEN s."PayMode" = 'card' THEN s."GrandTotal" END), 0) AS "cardSales",
      COUNT(CASE WHEN s."PayMode" = 'card' THEN 1 END)::int AS "cardCount",
      COALESCE(SUM(CASE WHEN s."PayMode" = 'upi' THEN s."GrandTotal" END), 0) AS "upiSales",
      COUNT(CASE WHEN s."PayMode" = 'upi' THEN 1 END)::int AS "upiCount",
      COALESCE(SUM(s."GrandTotal"), 0) AS "totalSales",
      COUNT(s."DocEntry")::int AS "saleCount"
    FROM "ShiftSession" sh
    LEFT JOIN "Linesales" s ON s."TenantId" = sh."TenantId" AND s."OutletId" = sh."OutletId"
      AND s."DocStatus" = 'COMPLETED'
      -- ShiftSession times are UTC "timestamp" columns; compare like with like.
      AND (s."CreateDate" AT TIME ZONE 'UTC') >= sh."OpenedAt" AND (s."CreateDate" AT TIME ZONE 'UTC') <= COALESCE(sh."ClosedAt", now() AT TIME ZONE 'UTC')
    WHERE sh."TenantId" = ${tenantId} AND sh."Id" = ANY(${shiftIds})
    GROUP BY sh."Id"`;

  const refundRows = await prisma.$queryRaw`
    SELECT sh."Id" AS "shiftId",
      COALESCE(SUM(CASE WHEN r."RefundTo" = 'cash' THEN r."GrandTotal" END), 0) AS "cashRefunds",
      COUNT(CASE WHEN r."RefundTo" = 'cash' THEN 1 END)::int AS "cashRefundCount",
      COALESCE(SUM(CASE WHEN r."RefundTo" = 'card' THEN r."GrandTotal" END), 0) AS "cardRefunds",
      COALESCE(SUM(CASE WHEN r."RefundTo" = 'upi' THEN r."GrandTotal" END), 0) AS "upiRefunds"
    FROM "ShiftSession" sh
    JOIN "SalesReturn" r ON r."TenantId" = sh."TenantId" AND r."RefundMode" = 'refund'
      AND r."CreatedAt" >= sh."OpenedAt" AND r."CreatedAt" <= COALESCE(sh."ClosedAt", now())
    JOIN "Linesales" s ON s."DocEntry" = r."DocEntry" AND s."OutletId" = sh."OutletId"
    WHERE sh."TenantId" = ${tenantId} AND sh."Id" = ANY(${shiftIds})
    GROUP BY sh."Id"`;

  const moveRows = await prisma.$queryRaw`
    SELECT x."ShiftSessionId" AS "shiftId", x.kind, SUM(x."Amount") AS amount, COUNT(*)::int AS count FROM (
      SELECT "ShiftSessionId", 'withdrawal' AS kind, "Amount" FROM "CashWithdrawal" WHERE "TenantId" = ${tenantId} AND "ShiftSessionId" = ANY(${shiftIds})
      UNION ALL
      SELECT "ShiftSessionId", 'deposit', "Amount" FROM "CashDeposit" WHERE "TenantId" = ${tenantId} AND "ShiftSessionId" = ANY(${shiftIds})
      UNION ALL
      SELECT "ShiftSessionId", 'transfer', "Amount" FROM "CashTransfer" WHERE "TenantId" = ${tenantId} AND "ShiftSessionId" = ANY(${shiftIds})
    ) x GROUP BY x."ShiftSessionId", x.kind`;

  const byShift = new Map(shiftIds.map((id) => [id, {
    cashSales: 0, cashCount: 0, cardSales: 0, cardCount: 0, upiSales: 0, upiCount: 0, totalSales: 0, saleCount: 0,
    cashRefunds: 0, cashRefundCount: 0, cardRefunds: 0, upiRefunds: 0,
    withdrawals: 0, deposits: 0, transfers: 0, movementCount: 0,
  }]));
  salesRows.forEach((r) => Object.assign(byShift.get(r.shiftId), {
    cashSales: n(r.cashSales), cashCount: r.cashCount, cardSales: n(r.cardSales), cardCount: r.cardCount,
    upiSales: n(r.upiSales), upiCount: r.upiCount, totalSales: n(r.totalSales), saleCount: r.saleCount,
  }));
  refundRows.forEach((r) => Object.assign(byShift.get(r.shiftId), {
    cashRefunds: n(r.cashRefunds), cashRefundCount: r.cashRefundCount, cardRefunds: n(r.cardRefunds), upiRefunds: n(r.upiRefunds),
  }));
  moveRows.forEach((r) => {
    const t = byShift.get(r.shiftId);
    if (!t) return;
    t[`${r.kind}s`] = n(r.amount);
    t.movementCount += r.count;
  });
  return byShift;
}

export async function getShiftVarianceReport(user, params = {}) {
  const range = defaultRange();
  const from = params.from || range.from;
  const to = params.to || range.to;
  const { start: fromStart } = dayBounds(from);
  const { end: toEnd } = dayBounds(to);
  if (toEnd < fromStart) throw new ApiError(400, '"To" date cannot be before "From" date');
  if ((toEnd - fromStart) / 86400000 > MAX_RANGE_DAYS) throw new ApiError(400, `Date range cannot exceed ${MAX_RANGE_DAYS} days`);

  const tenantId = user.tenantId;
  const outletIds = await resolveOutletIds(user, params.outletId);

  const inRange = await prisma.shiftSession.findMany({
    where: { tenantId, outletId: { in: outletIds }, openedAt: { gte: fromStart, lte: toEnd } },
    orderBy: [{ outletId: 'asc' }, { openedAt: 'asc' }],
    take: MAX_SHIFTS + 1,
    include: { outlet: { select: { name: true } } },
  });
  if (inRange.length > MAX_SHIFTS) throw new ApiError(400, 'Too many shifts in this range — narrow the date range');

  // Neighbours just outside the range, per outlet, so the first/last shift still
  // know their previous / next shift.
  const prevByOutlet = new Map();
  const nextByOutlet = new Map();
  for (const outletId of [...new Set(inRange.map((s) => s.outletId))]) {
    const first = inRange.find((s) => s.outletId === outletId);
    const last = [...inRange].reverse().find((s) => s.outletId === outletId);
    prevByOutlet.set(outletId, await prisma.shiftSession.findFirst({
      where: { tenantId, outletId, openedAt: { lt: first.openedAt } }, orderBy: { openedAt: 'desc' },
    }));
    nextByOutlet.set(outletId, await prisma.shiftSession.findFirst({
      where: { tenantId, outletId, openedAt: { gt: last.openedAt } }, orderBy: { openedAt: 'asc' },
    }));
  }

  const aggregates = inRange.length ? await aggregateShifts(tenantId, inRange.map((s) => s.id)) : new Map();

  const rows = inRange.map((shift, i) => {
    const sameOutletPrev = i > 0 && inRange[i - 1].outletId === shift.outletId ? inRange[i - 1] : null;
    const sameOutletNext = i < inRange.length - 1 && inRange[i + 1].outletId === shift.outletId ? inRange[i + 1] : null;
    const prev = sameOutletPrev || prevByOutlet.get(shift.outletId) || null;
    const next = sameOutletNext || nextByOutlet.get(shift.outletId) || null;
    const a = aggregates.get(shift.id);

    const cashPaidOut = round2(a.withdrawals + a.deposits + a.transfers);
    const expected = expectedClosingCashOf({
      openingCash: shift.openingCash, cashSales: a.cashSales, cashRefunds: a.cashRefunds,
      withdrawals: a.withdrawals, deposits: a.deposits, transfers: a.transfers,
    });
    const actual = shift.closingCash == null ? null : round2(shift.closingCash);
    const closingVariance = actual == null || shift.status !== 'CLOSED' ? null : round2(actual - expected);
    const closingStatus = closingStatusOf(shift, closingVariance);
    const handover = handoverOf(shift, next);

    const recordedExpected = shift.expectedClosingCash == null ? null : round2(shift.expectedClosingCash);
    const recordedVariance = shift.closingVariance == null ? null : round2(shift.closingVariance);

    return {
      id: shift.id,
      businessDate: dateKeyOf(shift.openedAt),
      crossesMidnight: shift.closedAt ? dateKeyOf(shift.closedAt) !== dateKeyOf(shift.openedAt) : false,
      shiftNo: shift.shiftNo,
      shiftName: shift.shiftName,
      outletId: shift.outletId,
      outletName: shift.outlet?.name || '',
      register: null, // no register/till concept exists: one drawer per outlet
      cashierId: shift.cashierId,
      cashierName: shift.cashierName,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      shiftStatus: shift.status,
      previousShift: prev ? { id: prev.id, shiftNo: prev.shiftNo, cashierName: prev.cashierName, closingCash: prev.closingCash == null ? null : round2(prev.closingCash) } : null,
      nextShift: next ? { id: next.id, shiftNo: next.shiftNo, cashierName: next.cashierName, openingCash: round2(next.openingCash) } : null,
      openingCash: round2(shift.openingCash),
      cashSales: round2(a.cashSales),
      cashRefunds: round2(a.cashRefunds),
      cashPaidIn: 0, // no cash paid-in transaction type exists in the schema
      cashPaidOut,
      cashWithdrawals: round2(a.withdrawals),
      cashDeposits: round2(a.deposits),
      cashTransfers: round2(a.transfers),
      expectedClosingCash: expected,
      actualClosingCash: actual,
      closingVariance,
      closingStatus,
      recordedAtClose: {
        expectedClosingCash: recordedExpected,
        closingVariance: recordedVariance,
        // closeShift() counted tendered cash (not net of change) and ignored cash refunds.
        differsFromRecomputed: recordedExpected != null && Math.abs(recordedExpected - expected) >= 0.005,
      },
      handover,
      card: {
        sales: round2(a.cardSales), refunds: round2(a.cardRefunds), net: round2(a.cardSales - a.cardRefunds), count: a.cardCount,
      },
      upi: {
        sales: round2(a.upiSales), refunds: round2(a.upiRefunds), net: round2(a.upiSales - a.upiRefunds), count: a.upiCount,
      },
      cardUpiReconciliation: 'NOT_TRACKED',
      approvalStatus: 'NOT_TRACKED',
      totalSales: round2(a.totalSales),
      transactionCount: a.saleCount + a.cashRefundCount + a.movementCount,
      hasUnresolvedVariance: (closingVariance != null && closingVariance !== 0) || (handover.variance != null && handover.variance !== 0),
    };
  });

  const scoped = params.cashierId ? rows.filter((r) => r.cashierId === params.cashierId) : rows;

  const summary = scoped.reduce((s, r) => {
    if (r.closingVariance != null && r.closingVariance < 0) { s.totalShortage += -r.closingVariance; s.shortageCount += 1; }
    if (r.closingVariance != null && r.closingVariance > 0) { s.totalExcess += r.closingVariance; s.excessCount += 1; }
    if (r.handover.status === 'PENDING') { s.pendingHandovers += 1; s.pendingHandoverAmount += r.handover.declared || 0; }
    if (r.handover.variance != null) s.netHandoverVariance += r.handover.variance;
    if (r.hasUnresolvedVariance) s.unresolvedVariances += 1;
    if (r.closingStatus === 'MISSING_COUNT') s.missingCounts += 1;
    return s;
  }, {
    shifts: scoped.length, totalShortage: 0, shortageCount: 0, totalExcess: 0, excessCount: 0,
    pendingHandovers: 0, pendingHandoverAmount: 0, netHandoverVariance: 0, unresolvedVariances: 0, missingCounts: 0,
  });
  ['totalShortage', 'totalExcess', 'pendingHandoverAmount', 'netHandoverVariance'].forEach((k) => { summary[k] = round2(summary[k]); });

  const filtered = scoped.filter((r) => matchesStatus(r, params.status || 'all'))
    .sort((x, y) => new Date(y.openedAt) - new Date(x.openedAt));
  const pageSize = params.pageSize || 10;
  const totalPages = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const page = Math.min(params.page || 1, totalPages);

  return {
    range: { from, to },
    summary,
    rows: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
    totalPages,
    notes: {
      register: 'Registers are not modelled: each outlet has a single cash drawer and one open shift at a time.',
      handover: 'Declared = outgoing shift counted closing cash; acknowledged = next shift counted opening cash.',
      approval: 'No variance approval/adjustment workflow exists yet, so every non-zero variance is unresolved.',
      cardUpi: 'No card/UPI settlement data exists, so reconciliation status cannot be determined.',
    },
  };
}

/** Drill-down: the underlying rows behind one shift's figures. */
export async function getShiftVarianceTransactions(user, shiftId) {
  const shift = await prisma.shiftSession.findFirst({
    where: { id: shiftId, tenantId: user.tenantId, ...(user.role === 'ADMIN' ? {} : { outletId: user.outletId || '' }) },
  });
  if (!shift) throw new ApiError(404, 'Shift not found');

  const windowEnd = shift.closedAt || new Date();
  const win = { gte: shift.openedAt, lte: windowEnd };

  const sales = (await prisma.tczOpos.findMany({
    where: { tenantId: user.tenantId, outletId: shift.outletId, docStatus: 'COMPLETED', createDate: win },
    orderBy: { createDate: 'asc' },
    select: { docEntry: true, docNum: true, createDate: true, payMode: true, grandTotal: true, received: true, changeAmount: true, createdBy: true },
  })).map(asSale);
  const returns = await prisma.salesReturn.findMany({
    where: { tenantId: user.tenantId, refundMode: 'refund', createdAt: win, tczBill: { outletId: shift.outletId } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, returnNo: true, createdAt: true, refundTo: true, grandTotal: true, cashierName: true, tczBill: { select: { docNum: true } } },
  });
  const [withdrawals, deposits, transfers] = [
    await prisma.cashWithdrawal.findMany({ where: { tenantId: user.tenantId, shiftSessionId: shift.id }, orderBy: { createdAt: 'asc' } }),
    await prisma.cashDeposit.findMany({ where: { tenantId: user.tenantId, shiftSessionId: shift.id }, orderBy: { createdAt: 'asc' } }),
    await prisma.cashTransfer.findMany({ where: { tenantId: user.tenantId, shiftSessionId: shift.id }, orderBy: { createdAt: 'asc' } }),
  ];

  // cashEffect: signed change to drawer cash (+ in, − out); 0 for non-cash tenders.
  const items = [
    { id: shift.id, type: 'OPENING', reference: `Shift ${shift.shiftNo}`, at: shift.openedAt, tender: 'cash', amount: n(shift.openingCash), cashEffect: n(shift.openingCash), note: 'Opening float' },
    ...sales.map((s) => ({
      id: s.id, type: 'SALE', reference: s.billNo, at: s.createdAt, tender: s.paymentMethod, amount: n(s.grandTotal),
      cashEffect: s.paymentMethod === 'cash' ? round2(n(s.receivedAmount) - Math.max(n(s.changeAmount), 0)) : 0,
      note: s.cashierName,
    })),
    ...returns.map((r) => ({
      id: r.id, type: 'REFUND', reference: r.returnNo, at: r.createdAt, tender: r.refundTo, amount: n(r.grandTotal),
      cashEffect: r.refundTo === 'cash' ? -n(r.grandTotal) : 0, note: `Against ${r.tczBill.docNum}`,
    })),
    ...withdrawals.map((m) => ({ id: m.id, type: 'WITHDRAWAL', reference: m.referenceNo, at: m.createdAt, tender: 'cash', amount: n(m.amount), cashEffect: -n(m.amount), note: m.purpose })),
    ...deposits.map((m) => ({ id: m.id, type: 'DEPOSIT', reference: m.referenceNo, at: m.createdAt, tender: 'cash', amount: n(m.amount), cashEffect: -n(m.amount), note: m.purpose })),
    ...transfers.map((m) => ({ id: m.id, type: 'TRANSFER', reference: m.referenceNo, at: m.createdAt, tender: 'cash', amount: n(m.amount), cashEffect: -n(m.amount), note: `${m.purpose} → ${m.toLocation}` })),
  ].sort((x, y) => new Date(x.at) - new Date(y.at));

  return {
    shift: { id: shift.id, shiftNo: shift.shiftNo, cashierName: shift.cashierName, openedAt: shift.openedAt, closedAt: shift.closedAt, status: shift.status },
    items,
    cashTotal: round2(items.reduce((sum, i) => sum + i.cashEffect, 0)),
  };
}
