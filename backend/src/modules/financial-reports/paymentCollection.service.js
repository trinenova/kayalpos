import { prisma } from '../../config/prisma.js';
import {
  resolveRange, resolveOutletIds, round2, n,
} from './common.js';

/**
 * Payment Collection: money actually collected on completed bills, by payment
 * mode, by day and by cashier, less cash/card/UPI refunds paid out for sales
 * returns.  Collected = Linesales.Paid (the part of the tender that was kept,
 * i.e. change given back is excluded); the unpaid part of a credit sale is
 * reported as "not collected".
 */
const MAIN_MODES = ['cash', 'card', 'upi', 'wallet'];
const modeOf = (m) => (MAIN_MODES.includes(m) ? m : 'other');

export async function getPaymentCollectionReport(user, params) {
  const { from, to, start, end } = resolveRange(params);
  const outletIds = await resolveOutletIds(user, params.outletId);

  const rows = await prisma.$queryRaw`
    SELECT to_char(s."CreateDate", 'YYYY-MM-DD') AS "day", COALESCE(s."PayMode", 'other') AS "mode",
      COALESCE(s."CreatedBy", 'Unknown') AS "cashier", COUNT(*)::int AS "bills",
      COALESCE(SUM(s."Paid"), 0) AS "paid", COALESCE(SUM(s."GrandTotal"), 0) AS "total", COALESCE(SUM(s."Balance"), 0) AS "balance"
    FROM "Linesales" s
    WHERE s."TenantId" = ${user.tenantId} AND s."OutletId" = ANY(${outletIds})
      AND s."DocStatus" = 'COMPLETED' AND s."CreateDate" >= ${start} AND s."CreateDate" <= ${end}
    GROUP BY 1, 2, 3`;

  const refunds = await prisma.$queryRaw`
    SELECT to_char(r."CreatedAt", 'YYYY-MM-DD') AS "day", COALESCE(r."RefundTo", 'other') AS "mode", COALESCE(SUM(r."GrandTotal"), 0) AS "amount"
    FROM "SalesReturn" r JOIN "Linesales" s ON s."DocEntry" = r."DocEntry"
    WHERE r."TenantId" = ${user.tenantId} AND s."OutletId" = ANY(${outletIds}) AND r."RefundMode" = 'refund'
      AND r."CreatedAt" >= ${start} AND r."CreatedAt" <= ${end}
    GROUP BY 1, 2`;

  const modes = new Map();
  const days = new Map();
  const cashiers = new Map();
  const modeRow = (m) => {
    const key = modeOf(m);
    if (!modes.has(key)) modes.set(key, { mode: key, bills: 0, collected: 0, refunds: 0 });
    return modes.get(key);
  };
  const dayRow = (d) => {
    if (!days.has(d)) days.set(d, { day: d, bills: 0, cash: 0, card: 0, upi: 0, wallet: 0, other: 0, refunds: 0 });
    return days.get(d);
  };

  rows.forEach((r) => {
    const m = modeRow(r.mode);
    m.bills += r.bills;
    m.collected += n(r.paid);
    const d = dayRow(r.day);
    d.bills += r.bills;
    d[modeOf(r.mode)] += n(r.paid);
    const c = cashiers.get(r.cashier) || { cashier: r.cashier, bills: 0, collected: 0 };
    c.bills += r.bills;
    c.collected += n(r.paid);
    cashiers.set(r.cashier, c);
  });
  refunds.forEach((r) => {
    modeRow(r.mode).refunds += n(r.amount);
    dayRow(r.day).refunds += n(r.amount);
  });

  const r2 = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === 'number' ? round2(v) : v]));
  const byMode = [...modes.values()].map((m) => ({ ...r2(m), net: round2(m.collected - m.refunds) })).sort((a, b) => b.collected - a.collected);
  const daily = [...days.values()].map((d) => ({ ...r2(d), total: round2(d.cash + d.card + d.upi + d.wallet + d.other), net: round2(d.cash + d.card + d.upi + d.wallet + d.other - d.refunds) }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));
  const collected = round2(byMode.reduce((s, m) => s + m.collected, 0));
  const refundTotal = round2(byMode.reduce((s, m) => s + m.refunds, 0));

  return {
    from,
    to,
    summary: {
      bills: rows.reduce((s, r) => s + r.bills, 0),
      billed: round2(rows.reduce((s, r) => s + n(r.total), 0)),
      collected,
      refunds: refundTotal,
      netCollection: round2(collected - refundTotal),
      notCollected: round2(rows.reduce((s, r) => s + n(r.balance), 0)),
    },
    byMode,
    daily,
    byCashier: [...cashiers.values()].map((c) => ({ ...c, collected: round2(c.collected) })).sort((a, b) => b.collected - a.collected),
    notes: {
      basis: 'Collected = amount actually kept on completed bills (change given back is excluded). Refunds are cash/card/UPI paid out on sales returns, dated when the return was made. Not collected = unpaid balance of credit sales.',
    },
  };
}
