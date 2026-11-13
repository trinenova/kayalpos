import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { buildReport, istDay, rangeBounds } from './salesReports.aggregate.js';
import { resolveOutletIds } from './salesReports.service.js';

/**
 * Daily / Monthly / Outlet-wise / Cashier-wise / Item-wise / Category-wise /
 * Brand-wise / Customer-wise sales reports. The aggregation itself is pure
 * (salesReports.aggregate.js, unit-tested); this file only fetches rows.
 *
 * Outlet scoping follows the same rule as the other Sales Reports in
 * salesReports.service.js: ADMIN may pick an outlet or "all"; everyone else
 * is limited to their own outlet (resolveOutletIds).
 */

// Hard ceiling on bills pulled into memory for one report request.
const MAX_BILLS = 60000;

/** Defaults a missing range to today (IST). */
export function resolveRange({ from, to } = {}) {
  const today = istDay(new Date());
  const start = from || to || today;
  const end = to || from || today;
  return { from: start, to: end };
}

/** Cashiers who have sold, limited to the outlets the user may see — for the filter dropdown. */
export async function listSalesCashiers(user, outletIds) {
  const rows = await prisma.tczOpos.findMany({
    where: {
      tenantId: user.tenantId,
      docStatus: 'COMPLETED',
      createdBy: { not: null },
      ...(outletIds?.length ? { outletId: { in: outletIds } } : {}),
    },
    select: { createdBy: true },
    distinct: ['createdBy'],
    orderBy: { createdBy: 'asc' },
  });
  return rows.map((c) => c.createdBy).filter(Boolean);
}

export async function getSalesSummaryReport(user, report, query = {}) {
  const { tenantId } = user;
  const { from, to } = resolveRange(query);
  if (from > to) throw new ApiError(400, '"To" date cannot be before "From" date');
  const { start, end } = rangeBounds(from, to);
  const { cashier, search } = query;
  const outletIds = await resolveOutletIds(user, query.outletId);

  // Only COMPLETED bills count (held bills are separate; cancelled ones are
  // dropped in buildReport — filtered there, not in SQL, so rows where Canceled
  // is NULL are NOT lost to SQL's NULL comparison rules).
  const billRows = await prisma.tczOpos.findMany({
    where: {
      tenantId,
      outletId: { in: outletIds },
      docStatus: 'COMPLETED',
      createDate: { gte: start, lte: end },
      ...(cashier ? { createdBy: cashier } : {}),
    },
    select: {
      docEntry: true, outletId: true, customerId: true, customerName: true, customerMobileNumber: true,
      createdBy: true, createDate: true, canceled: true, hold: true,
      subTotal: true, discountAmount: true, taxAmount: true, grandTotal: true,
      lines: {
        select: {
          productId: true, itemCode: true, itemName: true, uom: true, quantity: true, lineTotal: true, taxValue: true,
        },
      },
    },
    orderBy: { createDate: 'asc' },
    take: MAX_BILLS + 1,
  });
  if (billRows.length > MAX_BILLS) {
    throw new ApiError(400, 'Too many bills in this range — please narrow the date range or pick an outlet');
  }

  const bills = billRows.map((b) => ({
    id: String(b.docEntry),
    outletId: b.outletId,
    customerId: b.customerId,
    customerName: b.customerName,
    customerMobile: b.customerMobileNumber,
    cashier: b.createdBy,
    createdAt: b.createDate,
    canceled: b.canceled,
    hold: b.hold,
    subTotal: b.subTotal,
    discount: b.discountAmount,
    tax: b.taxAmount,
    grandTotal: b.grandTotal,
    lines: b.lines.map((l) => ({
      productId: l.productId, itemCode: l.itemCode, itemName: l.itemName, uom: l.uom,
      qty: l.quantity, lineTotal: l.lineTotal, taxValue: l.taxValue,
    })),
  }));

  const returnRows = await prisma.salesReturn.findMany({
    where: {
      tenantId,
      createdAt: { gte: start, lte: end },
      tczBill: { outletId: { in: outletIds } },
      ...(cashier ? { cashierName: cashier } : {}),
    },
    select: {
      customerId: true, customerName: true, cashierName: true, createdAt: true, grandTotal: true,
      tczBill: { select: { outletId: true } },
      items: { select: { productId: true, code: true, name: true, uom: true, qty: true, amount: true, taxRate: true } },
    },
  });
  const returns = returnRows.map((r) => ({
    outletId: r.tczBill?.outletId || null,
    customerId: r.customerId,
    customerName: r.customerName,
    cashier: r.cashierName,
    createdAt: r.createdAt,
    grandTotal: r.grandTotal,
    items: r.items,
  }));

  // Reference data, only for the ids that actually appear.
  const productIds = new Set();
  bills.forEach((b) => b.lines.forEach((l) => l.productId && productIds.add(l.productId)));
  returns.forEach((r) => r.items.forEach((i) => i.productId && productIds.add(i.productId)));
  const customerIds = new Set([...bills, ...returns].map((x) => x.customerId).filter(Boolean));

  const needsProducts = ['item', 'category', 'brand'].includes(report);
  const [products, outlets, customers] = await Promise.all([
    needsProducts && productIds.size
      ? prisma.product.findMany({
        where: { tenantId, id: { in: [...productIds] } },
        select: { id: true, code: true, name: true, group: true, brand: true, uom: true },
      })
      : [],
    report === 'outlet'
      ? prisma.outlet.findMany({ where: { tenantId }, select: { id: true, code: true, name: true } })
      : [],
    report === 'customer' && customerIds.size
      ? prisma.customer.findMany({
        where: { tenantId, id: { in: [...customerIds] } }, select: { id: true, code: true, name: true, mobile: true },
      })
      : [],
  ]);

  return buildReport(report, {
    from,
    to,
    bills,
    returns,
    search,
    productMeta: new Map(products.map((p) => [p.id, p])),
    outlets: new Map(outlets.map((o) => [o.id, o])),
    customers: new Map(customers.map((c) => [c.id, c])),
  });
}
