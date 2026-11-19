import { prisma } from '../../config/prisma.js';
import { getSalesOverviewSummary, getCustomerPurchaseSummaries, ownerFilter } from '../sale/sale.service.js';
import { asSale } from '../sale/tczSaleView.js';

/**
 * Home dashboard + Management Dashboard — real Prisma aggregations against
 * Sale / SaleLine / Customer / Product / Expense / the Stock Indent-
 * Transfer-Receipt-Return-Wastage-Count modules. Every field is computed
 * from actual tenant data, scoped by tenantId (always from the JWT — see
 * dashboard.controller.js). Anywhere a figure can't be honestly computed
 * from what this schema tracks (no Purchase Order/Invoice module, no
 * Accounts-Payable ledger, no Sales-Target module, no SAP integration), the
 * function's own doc comment says exactly what proxy was used instead, or
 * that the field stays zero because nothing backs it yet — never a
 * fabricated number standing in for one.
 *
 * Who sees which bills: every bill-based figure (sales, orders, payment mix,
 * top sellers, recent transactions, receivables ...) takes an `own` scope
 * from the controller. Administrators pass `null` and see every bill; any
 * other user passes `{ userId, name }` and only sees the bills they rang up
 * themselves (same `ownerFilter` rule the Line Sale / reports screens use).
 * Figures that aren't bills (products, customers, stock documents, expenses)
 * stay business-wide.
 */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

// Midnight-to-midnight bounds for a calendar day `offsetDays` before today
// (0 = today, 1 = yesterday), in the server's local time zone.
function dayBounds(offsetDays = 0) {
  const start = new Date();
  start.setDate(start.getDate() - offsetDays);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// "vs Yesterday" / "vs Last Month" style delta, shared by every stat tile
// that carries one. Flat (current === previous) reads as "up" with 0% —
// same as "no change" reading as neutral rather than a false decline.
function computeDelta(current, previous) {
  if (previous <= 0) {
    return { deltaPct: current > 0 ? 100 : 0, direction: current >= previous ? 'up' : 'down' };
  }
  const pct = ((current - previous) / previous) * 100;
  return { deltaPct: Math.abs(round2(pct)), direction: current >= previous ? 'up' : 'down' };
}

function periodToDays(period) {
  return period === 'week' ? 7 : 30;
}

// Every non-cash/card/upi/wallet tender (store credit, gift card, cheque,
// bank transfer, and the plain "credit" token) folds into the frontend's
// fixed "Credit" donut slice — HomePage.jsx's PAYMENT_COLORS only knows
// five buckets (Cash/UPI/Card/Wallet/Credit), unlike the Cashier Panel's
// tender reports which break "other" out in full (see sale.service.js).
const PAYMENT_BUCKET_LABELS = {
  cash: 'Cash', upi: 'UPI', card: 'Card', wallet: 'Wallet', credit: 'Credit',
  'store-credit': 'Credit', 'gift-card': 'Credit', cheque: 'Credit', 'bank-transfer': 'Credit',
};
function paymentBucketLabel(method) {
  return PAYMENT_BUCKET_LABELS[method] || 'Credit';
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/**
 * Total Sales (Today) + Orders (Today), each with a real "vs Yesterday"
 * delta. Scoped to `status: 'COMPLETED'` — a held bill hasn't actually been
 * paid for yet, so it shouldn't count as a sale.
 */
async function getTodayVsYesterdaySales(tenantId, outletFilter) {
  const today = dayBounds(0);
  const yesterday = dayBounds(1);

  const [todayAgg, yesterdayAgg] = await Promise.all([
    prisma.tczOpos.aggregate({
      where: { tenantId, ...outletFilter, docStatus: 'COMPLETED', createDate: { gte: today.start, lte: today.end } },
      _sum: { grandTotal: true },
      _count: { _all: true },
    }),
    prisma.tczOpos.aggregate({
      where: { tenantId, ...outletFilter, docStatus: 'COMPLETED', createDate: { gte: yesterday.start, lte: yesterday.end } },
      _sum: { grandTotal: true },
      _count: { _all: true },
    }),
  ]);

  const salesToday = round2(todayAgg._sum.grandTotal || 0);
  const salesYesterday = round2(yesterdayAgg._sum.grandTotal || 0);
  const ordersToday = todayAgg._count._all;
  const ordersYesterday = yesterdayAgg._count._all;

  return {
    totalSalesToday: { value: salesToday, ...computeDelta(salesToday, salesYesterday) },
    ordersToday: { value: ordersToday, ...computeDelta(ordersToday, ordersYesterday) },
  };
}

/**
 * Total Items (active Product count) + Low Stock Items. "Low stock" is
 * `availableQty <= reorderLevel` (see the Product model's reorderLevel
 * field, added specifically for this panel) — computed in JS after one
 * fetch of every active product's stock fields, since Prisma can't compare
 * two columns of the same row in a `where` filter without raw SQL, and this
 * dataset (active products for one tenant) is small enough that a raw query
 * would be premature.
 */
async function getInventoryStats(tenantId) {
  const [totalItems, products] = await Promise.all([
    prisma.product.count({ where: { tenantId, status: 'ACTIVE' } }),
    prisma.product.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: { id: true, name: true, uom: true, availableQty: true, reorderLevel: true },
    }),
  ]);

  const lowStock = products
    .filter((p) => p.availableQty <= p.reorderLevel)
    .sort((a, b) => (a.availableQty - a.reorderLevel) - (b.availableQty - b.reorderLevel));

  const lowStockDetails = lowStock.slice(0, 5).map((p) => ({
    id: p.id,
    name: p.name,
    currentStock: p.availableQty,
    currentStockUnit: p.uom,
    reorderLevel: p.reorderLevel,
    reorderUnit: p.uom,
    status: 'Low Stock',
  }));

  return {
    totalItems: { value: totalItems },
    lowStockItems: { value: lowStock.length },
    lowStockDetails,
  };
}

/**
 * Total Customers (active count) + "vs Last Month" delta — compares the
 * active customer count today against the active customer count as of 30
 * days ago (customers created on/before that date), i.e. real growth of the
 * customer base over the last month, not a fabricated trend.
 */
async function getCustomerStats(tenantId) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const [totalCustomers, customersLastMonth] = await Promise.all([
    prisma.customer.count({ where: { tenantId, status: 'ACTIVE' } }),
    prisma.customer.count({ where: { tenantId, status: 'ACTIVE', createdAt: { lte: cutoff } } }),
  ]);

  return { totalCustomers: { value: totalCustomers, ...computeDelta(totalCustomers, customersLastMonth) } };
}

/**
 * Sales Overview trend — daily totals of completed sales' grandTotal for the
 * last 7 (week) or 30 (month) days. Real per-day granularity throughout,
 * unlike the old mock's sparser every-5-days labels.
 */
async function getSalesOverview(tenantId, outletFilter, period) {
  const days = periodToDays(period);
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - (days - 1));
  rangeStart.setHours(0, 0, 0, 0);

  const sales = await prisma.tczOpos.findMany({
    where: { tenantId, ...outletFilter, docStatus: 'COMPLETED', createDate: { gte: rangeStart } },
    select: { createDate: true, grandTotal: true },
  });

  const buckets = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    buckets.push({ key: d.toDateString(), label: `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`, total: 0 });
  }
  const bucketByKey = Object.fromEntries(buckets.map((b) => [b.key, b]));

  sales.forEach((sale) => {
    const bucket = bucketByKey[new Date(sale.createDate).toDateString()];
    if (bucket) bucket.total += Number(sale.grandTotal);
  });

  return { categories: buckets.map((b) => b.label), values: buckets.map((b) => round2(b.total)) };
}

/**
 * Top Selling Items — real LinesaleItemDetails quantity/line total grouped by product for
 * the selected period, joined back to Product for name/uom. `where.header` is a
 * relation filter, since a line itself carries no tenantId/outletId.
 */
async function getTopSellingItems(tenantId, outletFilter, period) {
  const days = periodToDays(period);
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const grouped = await prisma.tczPos1.groupBy({
    by: ['productId'],
    where: { header: { tenantId, ...outletFilter, docStatus: 'COMPLETED', createDate: { gte: since } } },
    _sum: { quantity: true, lineTotal: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 5,
  });
  if (grouped.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: grouped.map((g) => g.productId) } },
    select: { id: true, name: true, uom: true },
  });
  const productById = Object.fromEntries(products.map((p) => [p.id, p]));

  return grouped.map((g) => {
    const product = productById[g.productId];
    return {
      id: g.productId,
      name: product?.name || 'Unknown Item',
      qty: Number(g._sum.quantity || 0),
      unit: product?.uom || '',
      salesAmount: round2(g._sum.lineTotal || 0),
    };
  });
}

/**
 * Payment Summary (Today) — real Sale rows for today grouped into the
 * fixed Cash/UPI/Card/Wallet/Credit buckets the frontend's donut colors
 * expect (see paymentBucketLabel above).
 */
async function getPaymentSummary(tenantId, outletFilter) {
  const today = dayBounds(0);
  const rows = await prisma.tczOpos.groupBy({
    by: ['payMode'],
    where: { tenantId, ...outletFilter, docStatus: 'COMPLETED', createDate: { gte: today.start, lte: today.end } },
    _sum: { grandTotal: true },
  });

  const totals = new Map();
  rows.forEach((row) => {
    const label = paymentBucketLabel(row.payMode);
    totals.set(label, (totals.get(label) || 0) + Number(row._sum.grandTotal || 0));
  });

  const breakdown = [...totals.entries()]
    .map(([method, amount]) => ({ method, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount);
  const total = round2(breakdown.reduce((sum, b) => sum + b.amount, 0));

  return { total, breakdown };
}

/** Recent Transactions — the latest 5 real Sale rows. */
async function getRecentTransactions(tenantId, outletFilter) {
  const sales = (await prisma.tczOpos.findMany({
    where: { tenantId, ...outletFilter },
    orderBy: { createDate: 'desc' },
    take: 5,
    select: {
      docEntry: true, docNum: true, customerName: true, grandTotal: true, createDate: true, docStatus: true,
    },
  })).map(asSale);

  return sales.map((sale) => ({
    id: sale.id,
    invoiceNo: sale.billNo,
    // Only Sale rows for now — SalesReturn isn't merged into this feed yet,
    // so "Return" rows the old mock showed don't appear here. A real gap,
    // not a silent one: flagging it rather than fabricating return rows.
    type: 'Sale',
    customer: sale.customerName,
    amount: round2(sale.grandTotal),
    time: formatTime(sale.createdAt),
    status: sale.status === 'HELD' ? 'Held' : 'Completed',
  }));
}

export async function getHomeSummary(tenantId, outletId, { salesPeriod = 'month', topSellingPeriod = 'month', own = null } = {}) {
  // Outlet + "only the bills this user made" (no-op for admins).
  const outletFilter = { ...(outletId ? { outletId } : {}), ...ownerFilter(own) };

  const [
    salesStats, inventoryStats, customerStats, salesOverview, topSellingItems, paymentSummary, recentTransactions,
  ] = await Promise.all([
    getTodayVsYesterdaySales(tenantId, outletFilter),
    getInventoryStats(tenantId),
    getCustomerStats(tenantId),
    getSalesOverview(tenantId, outletFilter, salesPeriod),
    getTopSellingItems(tenantId, outletFilter, topSellingPeriod),
    getPaymentSummary(tenantId, outletFilter),
    getRecentTransactions(tenantId, outletFilter),
  ]);

  return {
    outletId,
    stats: {
      totalSalesToday: salesStats.totalSalesToday,
      ordersToday: salesStats.ordersToday,
      totalItems: inventoryStats.totalItems,
      lowStockItems: inventoryStats.lowStockItems,
      totalCustomers: customerStats.totalCustomers,
    },
    salesOverview,
    topSellingItems,
    paymentSummary,
    recentTransactions,
    lowStockDetails: inventoryStats.lowStockDetails,
  };
}


// Start of the calendar month containing `date` (default: now), midnight
// local time.
function monthStart(date = new Date()) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Total Sales / Total Purchase (Today), each with a real "vs Yesterday"
 * delta, plus the Gross Profit / Net Profit proxies built from them.
 *
 * - Sales: identical real query to the Home dashboard's own stat (see
 *   getTodayVsYesterdaySales), tenant-wide (no outlet filter — this page is
 *   a whole-business view, unlike Home's per-outlet one).
 * - Purchase: there is no Purchase Order/Invoice module in this schema —
 *   the closest real "goods bought today" event is a Stock Receipt (a GRN)
 *   moving to `status: 'received'`, valued at its own
 *   `totalEstimatedValue`. Scoped by `receivedOn` (the actual goods-in
 *   moment), not `createdAt`, matching that model's own doc comment.
 * - Gross Profit: Sales − Purchase for the same day. A day-level cash-basis
 *   approximation, not a true per-item COGS margin — Product has no cost
 *   field, only `salePrice`/`mrp`, so a real margin can't be computed today.
 * - Net Profit: Gross Profit − real Expense rows logged for the day
 *   (`expenseDate`, not `createdAt`, same reasoning as the Expense model's
 *   own doc comment).
 */
async function getSalesPurchaseProfit(tenantId, own = null) {
  const today = dayBounds(0);
  const yesterday = dayBounds(1);

  const [
    salesToday, salesYesterday, purchaseToday, purchaseYesterday, expenseToday, expenseYesterday,
  ] = await Promise.all([
    prisma.tczOpos.aggregate({
      where: { tenantId, ...ownerFilter(own), docStatus: 'COMPLETED', createDate: { gte: today.start, lte: today.end } },
      _sum: { grandTotal: true },
    }),
    prisma.tczOpos.aggregate({
      where: { tenantId, ...ownerFilter(own), docStatus: 'COMPLETED', createDate: { gte: yesterday.start, lte: yesterday.end } },
      _sum: { grandTotal: true },
    }),
    prisma.stockReceipt.aggregate({
      where: { tenantId, status: 'received', receivedOn: { gte: today.start, lte: today.end } },
      _sum: { totalEstimatedValue: true },
    }),
    prisma.stockReceipt.aggregate({
      where: { tenantId, status: 'received', receivedOn: { gte: yesterday.start, lte: yesterday.end } },
      _sum: { totalEstimatedValue: true },
    }),
    prisma.expense.aggregate({
      where: { tenantId, expenseDate: { gte: today.start, lte: today.end } },
      _sum: { totalAmount: true },
    }),
    prisma.expense.aggregate({
      where: { tenantId, expenseDate: { gte: yesterday.start, lte: yesterday.end } },
      _sum: { totalAmount: true },
    }),
  ]);

  const sales = round2(salesToday._sum.grandTotal || 0);
  const salesY = round2(salesYesterday._sum.grandTotal || 0);
  const purchase = round2(purchaseToday._sum.totalEstimatedValue || 0);
  const purchaseY = round2(purchaseYesterday._sum.totalEstimatedValue || 0);
  const expenses = round2(expenseToday._sum.totalAmount || 0);
  const expensesY = round2(expenseYesterday._sum.totalAmount || 0);

  const grossProfit = round2(sales - purchase);
  const grossProfitY = round2(salesY - purchaseY);
  const netProfit = round2(grossProfit - expenses);
  const netProfitY = round2(grossProfitY - expensesY);

  return {
    totalSalesToday: { value: sales, ...computeDelta(sales, salesY) },
    totalPurchaseToday: { value: purchase, ...computeDelta(purchase, purchaseY) },
    grossProfitToday: { value: grossProfit, ...computeDelta(grossProfit, grossProfitY) },
    netProfitToday: { value: netProfit, ...computeDelta(netProfit, netProfitY) },
    // Expenses "up" should read as a decline in a delta chip's usual sense —
    // computeDelta's direction is purely mathematical (current >= previous
    // => 'up'), so an expense increase already comes out 'up' here, and
    // AlertStatsRow/StatCard just render it in the tile's own fixed color,
    // same as the old mock's totalExpensesToday: { direction: 'down' } was
    // just one illustrative sample, not a rule this recomputes.
    totalExpensesToday: { value: expenses, ...computeDelta(expenses, expensesY) },
  };
}

/**
 * One fetch of every product's stock fields, tenant-wide (Product has no
 * outlet scoping — see its own doc comment), reused to derive every
 * inventory-shaped figure on this page: Stock Value, the Low Stock/Out of
 * Stock alert tiles, and the Inventory Summary panel's breakdown. Buckets
 * are mutually exclusive (an active product is in exactly one of In Stock /
 * Low Stock / Out of Stock), unlike the Home dashboard's own lowStockItems
 * count, which is inclusive of zero — different pages, each internally
 * consistent, both real.
 */
async function getProductInventory(tenantId) {
  const [totalItems, activeProducts] = await Promise.all([
    prisma.product.count({ where: { tenantId } }),
    prisma.product.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: { id: true, availableQty: true, reorderLevel: true, salePrice: true },
    }),
  ]);

  const outOfStock = activeProducts.filter((p) => p.availableQty <= 0);
  const lowStock = activeProducts.filter((p) => p.availableQty > 0 && p.availableQty <= p.reorderLevel);
  const inStock = activeProducts.filter((p) => p.availableQty > p.reorderLevel);
  const stockValue = round2(activeProducts.reduce((sum, p) => sum + p.availableQty * Number(p.salePrice), 0));

  return {
    totalItems,
    activeItems: activeProducts.length,
    blockedItems: totalItems - activeProducts.length,
    outOfStockCount: outOfStock.length,
    lowStockCount: lowStock.length,
    inStockCount: inStock.length,
    stockValue,
  };
}

/**
 * The six-tile alert row (Low Stock / Out of Stock / Pending Indents / GRNs
 * / Transfers / Approvals) + SAP sync. Each "pending" tile maps to the one
 * real workflow state each stock module can actually be in today:
 *
 * - Pending Indents: Stock Indent has no reachable "approved" state yet
 *   (see that model's own doc comment) — every non-cancelled indent is
 *   `status: 'draft'`, so that's the honest count of indents still awaiting
 *   the approval workflow that doesn't exist yet.
 * - Pending GRNs: Stock Receipts not yet moved to `status: 'received'`.
 * - Pending Transfers: Stock Transfers not yet moved to `status:
 *   'received'` — i.e. still 'draft' or 'in-transit' (the two states this
 *   module can actually reach — see its own doc comment).
 * - Pending Approvals: the three OTHER stock modules that each have their
 *   own real draft -> finalized workflow (Stock Return draft/accepted,
 *   Stock Wastage draft/approved, Stock Count draft/completed) — summed,
 *   since none of them gets its own tile on this row.
 *
 * SAP sync has no integration anywhere in this codebase — reported as
 * 'Not Integrated' rather than a fabricated "Connected" status with a fake
 * timestamp.
 */
async function getOperationalAlerts(tenantId, inventory) {
  const [pendingIndents, pendingGrns, pendingTransfers, pendingReturns, pendingWastages, pendingCounts] = await Promise.all([
    prisma.stockIndent.count({ where: { tenantId, status: 'draft' } }),
    prisma.stockReceipt.count({ where: { tenantId, status: 'draft' } }),
    prisma.stockTransfer.count({ where: { tenantId, status: { in: ['draft', 'in-transit'] } } }),
    prisma.stockReturn.count({ where: { tenantId, status: 'draft' } }),
    prisma.stockWastage.count({ where: { tenantId, status: 'draft' } }),
    prisma.stockCount.count({ where: { tenantId, status: 'draft' } }),
  ]);

  return {
    lowStockItems: inventory.lowStockCount,
    outOfStockItems: inventory.outOfStockCount,
    pendingIndents,
    pendingGrns,
    pendingTransfers,
    pendingApprovals: pendingReturns + pendingWastages + pendingCounts,
    sapSyncStatus: 'Not Integrated',
    sapLastSyncAt: null,
  };
}

/**
 * Sales by Outlet (Today) — real Sale rows grouped by outlet, same
 * "Unassigned" bucket convention as sale.service.js's getDiscountSummary for
 * any sale recorded before the outletId column existed.
 */
async function getSalesByOutlet(tenantId, own = null) {
  const today = dayBounds(0);
  const [sales, outlets] = await Promise.all([
    prisma.tczOpos.findMany({
      where: { tenantId, ...ownerFilter(own), docStatus: 'COMPLETED', createDate: { gte: today.start, lte: today.end } },
      select: { outletId: true, grandTotal: true },
    }),
    prisma.outlet.findMany({ where: { tenantId }, select: { id: true, name: true } }),
  ]);
  const outletNameById = Object.fromEntries(outlets.map((o) => [o.id, o.name]));

  const totals = new Map();
  sales.forEach((sale) => {
    const key = sale.outletId || 'unassigned';
    totals.set(key, (totals.get(key) || 0) + Number(sale.grandTotal));
  });

  const breakdown = [...totals.entries()]
    .map(([outletId, amount]) => ({
      outlet: outletId === 'unassigned' ? 'Unassigned' : (outletNameById[outletId] || 'Unknown Outlet'),
      amount: round2(amount),
    }))
    .sort((a, b) => b.amount - a.amount);

  return { total: round2(breakdown.reduce((sum, b) => sum + b.amount, 0)), breakdown };
}

/**
 * Today's Outlet Performance table — real Sale rows per active outlet.
 * `achievementPct` has no real Sales Target module to measure against (none
 * exists in this schema), so rather than fabricate a target, it's reported
 * against an explicit, honestly-labeled stand-in baseline: an even split of
 * today's total tenant-wide sales across every active outlet. An outlet
 * selling exactly its "fair share" reads 100%; this is clearly a relative
 * share metric, not a real target vs. achievement figure — flagging this
 * plainly rather than pretending a target-setting feature exists.
 */
async function getOutletPerformance(tenantId, own = null) {
  const today = dayBounds(0);
  const outlets = await prisma.outlet.findMany({ where: { tenantId, isActive: true }, select: { id: true, name: true } });
  if (outlets.length === 0) return [];

  const sales = await prisma.tczOpos.findMany({
    where: { tenantId, ...ownerFilter(own), docStatus: 'COMPLETED', createDate: { gte: today.start, lte: today.end } },
    select: { outletId: true, grandTotal: true },
  });

  const byOutlet = new Map();
  sales.forEach((sale) => {
    if (!sale.outletId) return;
    const entry = byOutlet.get(sale.outletId) || { sales: 0, transactions: 0 };
    entry.sales += Number(sale.grandTotal);
    entry.transactions += 1;
    byOutlet.set(sale.outletId, entry);
  });

  const totalSales = [...byOutlet.values()].reduce((sum, o) => sum + o.sales, 0);
  const fairShare = outlets.length > 0 ? totalSales / outlets.length : 0;

  return outlets.map((outlet) => {
    const entry = byOutlet.get(outlet.id) || { sales: 0, transactions: 0 };
    return {
      id: outlet.id,
      outlet: outlet.name,
      sales: round2(entry.sales),
      transactions: entry.transactions,
      avgBillValue: entry.transactions > 0 ? round2(entry.sales / entry.transactions) : 0,
      achievementPct: fairShare > 0 ? Math.round((entry.sales / fairShare) * 100) : 0,
    };
  }).sort((a, b) => b.sales - a.sales);
}

/** Expense Summary (This Month) — real Expense rows grouped by category. */
async function getExpenseSummary(tenantId) {
  const expenses = await prisma.expense.findMany({
    where: { tenantId, expenseDate: { gte: monthStart() } },
    select: { category: true, totalAmount: true },
  });

  const totals = new Map();
  expenses.forEach((e) => {
    totals.set(e.category, (totals.get(e.category) || 0) + Number(e.totalAmount));
  });
  const breakdown = [...totals.entries()]
    .map(([category, amount]) => ({ category, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount);

  return { total: round2(breakdown.reduce((sum, b) => sum + b.amount, 0)), breakdown };
}

/**
 * Inventory Summary panel — Total/Active/Blocked items and Stock in Hand
 * reuse the same product snapshot as the alert tiles (see
 * getProductInventory). "Blocked" maps onto INACTIVE products — the closest
 * real status this schema has to that label, there being no separate
 * blocked/hold flag. Stock Movement (Today) is a real, but partial, proxy:
 * the value of goods sold today (Sale lines) plus the value of goods
 * received today (Stock Receipts) — the two stock-affecting events this
 * schema can actually see happen on a given day, not a full stock-ledger
 * movement total (there is no stock ledger yet — Product.availableQty is a
 * single running counter, per its own doc comment).
 */
async function getInventorySummary(tenantId, inventory, own = null) {
  const today = dayBounds(0);
  const [soldToday, receivedToday] = await Promise.all([
    prisma.tczPos1.aggregate({
      where: { header: { tenantId, ...ownerFilter(own), docStatus: 'COMPLETED', createDate: { gte: today.start, lte: today.end } } },
      _sum: { lineTotal: true },
    }),
    prisma.stockReceipt.aggregate({
      where: { tenantId, status: 'received', receivedOn: { gte: today.start, lte: today.end } },
      _sum: { totalEstimatedValue: true },
    }),
  ]);

  const stockMovementToday = round2(Number(soldToday._sum.lineTotal || 0) + Number(receivedToday._sum.totalEstimatedValue || 0));

  return {
    totalItems: inventory.totalItems,
    activeItems: inventory.activeItems,
    stockInHand: inventory.stockValue,
    stockMovementToday,
    breakdown: [
      { status: 'In Stock', count: inventory.inStockCount },
      { status: 'Low Stock', count: inventory.lowStockCount },
      { status: 'Out of Stock', count: inventory.outOfStockCount },
      { status: 'Blocked', count: inventory.blockedItems },
    ],
  };
}

/**
 * Receivables & Payables panel.
 *
 * - Receivables: real, via the same `grandTotal − receivedAmount` proxy
 *   sale.service.js's own getSalesOverviewSummary/getCustomerPurchaseSummaries
 *   already use and document (reused here rather than reimplemented) —
 *   under-paid/credit sales are the only honest "money customers owe"
 *   figure this schema tracks, there being no separate ledger. "Overdue" is
 *   that same outstanding amount narrowed to sales placed 30+ days ago — a
 *   defined aging cut, not a tracked due-date (none exists on Sale).
 * - Payables: genuinely NOT tracked anywhere in this schema — Stock Receipt
 *   records what was received, never what was paid to the supplier for it
 *   (no amountPaid/settlement field, no Purchase Invoice/Payment module).
 *   Reported as zero rather than inventing a number, until a real
 *   Accounts-Payable ledger exists.
 */
async function getReceivablesPayables(tenantId, own = null) {
  const cutoff30 = new Date();
  cutoff30.setDate(cutoff30.getDate() - 30);

  const [overview, customerSummaries, overdueSales] = await Promise.all([
    getSalesOverviewSummary(tenantId, own),
    getCustomerPurchaseSummaries(tenantId, own),
    prisma.tczOpos.findMany({
      where: { tenantId, ...ownerFilter(own), createDate: { lte: cutoff30 } },
      select: { grandTotal: true, received: true },
    }),
  ]);

  const customersDue = Object.values(customerSummaries).filter((c) => c.outstanding > 0).length;
  const overdue = round2(overdueSales.reduce((sum, sale) => sum + Math.max(Number(sale.grandTotal) - Number(sale.received), 0), 0));

  return {
    receivables: { total: overview.outstandingAmount, overdue, customersDue },
    // See doc comment above — genuinely unavailable until a Payables ledger exists.
    payables: { total: 0, overdue: 0, suppliersDue: 0 },
  };
}

/**
 * Profit Overview panel (This Month) — same Sales/Purchase/Gross Profit/Net
 * Profit proxy chain as getSalesPurchaseProfit above, just summed over the
 * calendar month instead of the day. `totalSales` reuses
 * sale.service.js's own getSalesOverviewSummary rather than re-querying.
 */
async function getProfitOverview(tenantId, own = null) {
  const start = monthStart();

  const [overview, purchaseAgg, expenseAgg] = await Promise.all([
    getSalesOverviewSummary(tenantId, own),
    prisma.stockReceipt.aggregate({
      where: { tenantId, status: 'received', receivedOn: { gte: start } },
      _sum: { totalEstimatedValue: true },
    }),
    prisma.expense.aggregate({
      where: { tenantId, expenseDate: { gte: start } },
      _sum: { totalAmount: true },
    }),
  ]);

  const totalSales = overview.totalSalesThisMonth;
  const totalPurchase = round2(purchaseAgg._sum.totalEstimatedValue || 0);
  const totalExpenses = round2(expenseAgg._sum.totalAmount || 0);
  const grossProfit = round2(totalSales - totalPurchase);
  const netProfit = round2(grossProfit - totalExpenses);

  return {
    totalSales, totalPurchase, grossProfit, totalExpenses, netProfit,
  };
}

export async function getManagementSummary(tenantId, own = null) {
  const billScope = ownerFilter(own);
  const inventory = await getProductInventory(tenantId);

  const [
    salesPurchaseProfit, alerts, salesByOutlet, paymentMethodSummary, topSellingItems,
    outletPerformance, expenseSummary, inventorySummary, receivablesPayables, profitOverview, salesTrend,
  ] = await Promise.all([
    getSalesPurchaseProfit(tenantId, own),
    getOperationalAlerts(tenantId, inventory),
    getSalesByOutlet(tenantId, own),
    getPaymentSummary(tenantId, billScope),
    getTopSellingItems(tenantId, billScope, 'month'),
    getOutletPerformance(tenantId, own),
    getExpenseSummary(tenantId),
    getInventorySummary(tenantId, inventory, own),
    getReceivablesPayables(tenantId, own),
    getProfitOverview(tenantId, own),
    getSalesOverview(tenantId, billScope, 'month'),
  ]);

  return {
    stats: {
      totalSalesToday: salesPurchaseProfit.totalSalesToday,
      totalPurchaseToday: salesPurchaseProfit.totalPurchaseToday,
      grossProfitToday: salesPurchaseProfit.grossProfitToday,
      netProfitToday: salesPurchaseProfit.netProfitToday,
      totalExpensesToday: salesPurchaseProfit.totalExpensesToday,
      stockValue: { value: inventory.stockValue },
    },
    salesTrend,
    salesByOutlet,
    paymentMethodSummary,
    alerts,
    topSellingItems,
    outletPerformance,
    expenseSummary,
    inventorySummary,
    receivablesPayables,
    profitOverview,
  };
}
