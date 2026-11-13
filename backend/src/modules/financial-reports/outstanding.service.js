import { prisma } from '../../config/prisma.js';
import { resolveRange, resolveOutletIds, round2 } from './common.js';

/**
 * Outstanding report, as of the "To" date.
 *  Customers: completed bills not fully paid (Balance = grand total - received,
 *             e.g. credit sales), grouped by customer and aged by bill date.
 *  Suppliers: stock receipts marked received. Supplier payments are not
 *             recorded anywhere in the app yet, so the whole received value is
 *             shown as payable and flagged as such.
 */
export async function getOutstandingReport(user, params) {
  const { to, end } = resolveRange(params);
  const outletIds = await resolveOutletIds(user, params.outletId);

  const bills = await prisma.$queryRaw`
    SELECT s."DocEntry"::text AS "id", s."DocNum" AS "billNo", COALESCE(s."CustomerName", 'Walk-in Customer') AS "customer",
      s."CustomerMobileNumber" AS "mobile", s."CreateDate" AS "date", s."GrandTotal" AS "total", s."Paid" AS "paid", s."Balance" AS "balance"
    FROM "Linesales" s
    WHERE s."TenantId" = ${user.tenantId} AND s."OutletId" = ANY(${outletIds})
      AND s."DocStatus" = 'COMPLETED' AND COALESCE(s."Balance", 0) > 0 AND s."CreateDate" <= ${end}
    ORDER BY s."CreateDate" ASC LIMIT 2000`;

  const asOf = end.getTime();
  const rows = bills.map((b) => ({
    id: b.id,
    billNo: b.billNo,
    customer: b.customer,
    mobile: b.mobile,
    date: new Date(b.date).toISOString().slice(0, 10),
    total: round2(b.total),
    paid: round2(b.paid),
    balance: round2(b.balance),
    ageDays: Math.max(0, Math.floor((asOf - new Date(b.date).getTime()) / 86400000)),
  }));

  const bucketOf = (d) => (d <= 30 ? 'd0_30' : d <= 60 ? 'd31_60' : 'd61_plus');
  const aging = { d0_30: 0, d31_60: 0, d61_plus: 0 };
  const byCustomer = new Map();
  rows.forEach((r) => {
    aging[bucketOf(r.ageDays)] += r.balance;
    const key = `${r.customer}|${r.mobile || ''}`;
    const c = byCustomer.get(key) || {
      customer: r.customer, mobile: r.mobile, bills: 0, balance: 0, oldestDays: 0,
    };
    c.bills += 1;
    c.balance += r.balance;
    c.oldestDays = Math.max(c.oldestDays, r.ageDays);
    byCustomer.set(key, c);
  });
  const customers = [...byCustomer.values()].map((c) => ({ ...c, balance: round2(c.balance) })).sort((a, b) => b.balance - a.balance);

  const suppliers = await prisma.stockReceipt.groupBy({
    by: ['supplierName'],
    where: { tenantId: user.tenantId, status: 'received', fromOutletId: { in: outletIds }, receivedOn: { lte: end } },
    _sum: { totalEstimatedValue: true },
    _count: true,
    orderBy: { _sum: { totalEstimatedValue: 'desc' } },
  });
  const supplierRows = suppliers.map((s) => ({
    supplier: s.supplierName, receipts: s._count, payable: round2(s._sum.totalEstimatedValue),
  }));

  const customerTotal = round2(rows.reduce((s, r) => s + r.balance, 0));
  return {
    asOf: to,
    summary: {
      customerOutstanding: customerTotal,
      customersWithBalance: customers.length,
      unpaidBills: rows.length,
      supplierPayable: round2(supplierRows.reduce((s, r) => s + r.payable, 0)),
      over60Days: round2(aging.d61_plus),
    },
    aging: [
      { bucket: '0-30 days', amount: round2(aging.d0_30) },
      { bucket: '31-60 days', amount: round2(aging.d31_60) },
      { bucket: 'Over 60 days', amount: round2(aging.d61_plus) },
    ],
    customers,
    bills: rows,
    suppliers: supplierRows,
    notes: {
      customers: 'Customer outstanding = unpaid balance on completed bills (e.g. credit sales). Later collections against a bill are not recorded separately yet, so the balance is as billed.',
      suppliers: 'Supplier payments are not recorded in the app yet, so this is the value of all stock received, not a true payable balance.',
    },
  };
}
