import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { outletIdFilter, outletAnd, outletFieldFilter } from '../../utils/outletScope.js';

/**
 * Expense report (Reports > Financial Reports > Expenses). Read-only, built
 * from the real Expense rows (Expenses page), keyed on the expense's own
 * ExpenseDate (when it was incurred, not when it was logged).
 *   Total = sum of totalAmount (amount + tax); tax is shown separately.
 */
const MAX_RANGE_DAYS = 366;
const MAX_ROWS = 5000;
const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

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

export async function listExpenseReportFilterOptions(user) {
  const mayChoose = user.role === 'ADMIN';
  const [outlets, cats] = await Promise.all([
    prisma.outlet.findMany({
      where: { tenantId: user.tenantId, ...(mayChoose ? outletIdFilter(user) : { id: user.outletId || '' }) },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.expense.findMany({ where: { tenantId: user.tenantId }, select: { category: true }, distinct: ['category'], orderBy: { category: 'asc' } }),
  ]);
  return { outlets, canChooseOutlet: mayChoose, categories: cats.map((c) => c.category) };
}

function group(rows, keyOf) {
  const map = new Map();
  rows.forEach((r) => {
    const key = keyOf(r);
    const g = map.get(key) || { key, count: 0, amount: 0, tax: 0, total: 0 };
    g.count += 1;
    g.amount += Number(r.amount);
    g.tax += Number(r.tax);
    g.total += Number(r.totalAmount);
    map.set(key, g);
  });
  return [...map.values()].map((g) => ({
    ...g, amount: round2(g.amount), tax: round2(g.tax), total: round2(g.total),
  }));
}

export async function getExpenseReport(user, params = {}) {
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

  const rows = await prisma.expense.findMany({
    where: {
      tenantId: user.tenantId,
      // Tenant-wide expenses (no outlet) count only when "all outlets" is chosen.
      OR: [{ outletId: { in: outletIds } }, ...(params.outletId === 'all' && user.role === 'ADMIN' ? [{ outletId: null }] : [])],
      expenseDate: { gte: start, lte: end },
      ...(params.category ? { category: params.category } : {}),
    },
    orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
    take: MAX_ROWS,
  });

  const totalAmount = round2(rows.reduce((s, r) => s + Number(r.totalAmount), 0));
  const tax = round2(rows.reduce((s, r) => s + Number(r.tax), 0));
  const byCategory = group(rows, (r) => r.category)
    .map((g) => ({ category: g.key, count: g.count, total: g.total, sharePct: totalAmount > 0 ? round2((g.total / totalAmount) * 100) : 0 }))
    .sort((a, b) => b.total - a.total);
  const byPayment = group(rows, (r) => r.paymentMode)
    .map((g) => ({ mode: g.key, count: g.count, total: g.total }))
    .sort((a, b) => b.total - a.total);
  const daily = group(rows, (r) => dateKeyOf(r.expenseDate))
    .map((g) => ({ day: g.key, count: g.count, amount: g.amount, tax: g.tax, total: g.total }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));

  return {
    from,
    to,
    truncated: rows.length === MAX_ROWS,
    summary: {
      count: rows.length,
      totalAmount,
      tax,
      excludingTax: round2(totalAmount - tax),
      avgExpense: rows.length ? round2(totalAmount / rows.length) : 0,
      topCategory: byCategory[0]?.category || null,
    },
    byCategory,
    byPayment,
    daily,
    rows: rows.map((r) => ({
      id: r.id,
      referenceNo: r.referenceNo,
      date: dateKeyOf(r.expenseDate),
      category: r.category,
      description: r.description,
      paidToVendor: r.paidToVendor,
      paymentMode: r.paymentMode,
      amount: Number(r.amount),
      tax: Number(r.tax),
      total: Number(r.totalAmount),
    })),
    notes: { basis: 'Expenses are counted on the date they were incurred. Totals include tax.' },
  };
}
