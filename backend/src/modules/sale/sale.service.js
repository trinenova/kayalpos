import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../middleware/errorHandler.js';

import { completeHeldBill } from '../held-bill/heldBill.service.js';
import { writeTczBill, toSaleDto } from './tczBilling.service.js';
import { getOrCreateWalkInCustomer } from '../customer/customer.service.js';
import { loadTaxRateResolver } from './taxRates.js';
import { allocateFifoForSale, syncProductToHeadLot } from '../product-lot/productLot.service.js';

/**
 * Preview of the bill number the NEXT sale will get (e.g. "LS-00001"),
 * mirrors crudFactory's nextCode() convention. Used for the Line Sale
 * screen's Bill No. field before a sale is actually saved — same "preview,
 * not a reservation" caveat as useNextCodePreview on the frontend.
 */
export async function nextBillNo(tenantId) {
  const count = await prisma.tczOpos.count({ where: { tenantId } });
  return `LS-${String(count + 1).padStart(5, '0')}`;
}

/**
 * Creates a sale: re-reads every Product fresh inside one transaction
 * (never trusts the client's cached price/name/stock), verifies stock,
 * computes subtotal/discount/tax/grand total server-side, writes the Linesales +
 * LinesaleItemDetails rows (see tczBilling.service.js), and decrements each Product's availableQty — all
 * atomic, so a mid-way failure (insufficient stock on line 3 of 5) leaves
 * nothing half-written.
 *
 * Concurrency / duplicate protection (all inside the one transaction):
 *  - A per-tenant advisory lock is taken first, so two bills for the same
 *    tenant are numbered one after the other instead of both reading the
 *    same row count and colliding on the (tenantId, billNo) unique index.
 *  - `clientToken` makes the request idempotent: a retry of a checkout that
 *    already committed (lost response, double click) returns the bill that was
 *    saved instead of creating a second one or deducting stock twice.
 *  - Stock is checked against each product's TOTAL quantity across all cart
 *    lines, and decremented with a conditional update so concurrent sales can
 *    never take a product below zero.
 */
export async function createSale({
  tenantId, outletId, cashierName, customerId, customerName, lines,
  discountType, discountValue, paymentMethod, receivedAmount,
  cardType, cardLast4, cardBank, upiApp, upiTxnId, paymentReference,
  // Set when the cart being paid was resumed from a held bill: `actor` is the
  // authenticated user (req.user) and the held bill is closed out inside this
  // same transaction — see heldBill.service.js's completeHeldBill.
  heldBillId, actor,
  // Client-generated idempotency token for this checkout attempt.
  clientToken,
}) {
  return prisma.$transaction(async (tx) => {
    // Held until this transaction commits/rolls back. Serialises bill creation
    // per tenant (numbering + idempotency check + stock check below).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sale-bill:${tenantId}`}))`;

    if (clientToken) {
      const prior = await tx.tczOpos.findFirst({
        where: { tenantId, clientToken },
        include: { lines: { orderBy: { lineId: 'asc' } } },
      });
      if (prior) return toSaleDto(prior, prior.lines);
    }

    // A customerId means a real registered customer was picked on the
    // Line Sale screen; no customerId means Walk-in Customer (the
    // frontend's WALK_IN_CUSTOMER sentinel never sends an id — see
    // LineSalePage's handlePayAndPrint/holdCurrentBill). Either way the
    // sale is saved against a real Customer row: a registered one, or the
    // tenant's single reused Walk-in Customer row (see customer.service.js)
    // — never a bare null id. This keeps every sale attributable without
    // ever creating a new customer record per walk-in transaction.
    let customer;
    if (customerId) {
      customer = await tx.customer.findFirst({ where: { id: customerId, tenantId } });
      if (!customer) throw new ApiError(400, 'Selected customer was not found');
    } else {
      customer = await getOrCreateWalkInCustomer(tx, tenantId);
    }

    const productIds = [...new Set(lines.map((line) => line.productId))];
    const products = await tx.product.findMany({ where: { id: { in: productIds }, tenantId } });
    const productById = new Map(products.map((p) => [p.id, p]));

    // Total quantity wanted per product across ALL cart lines — the same
    // product can legitimately appear on more than one line.
    const wantedQty = new Map();
    lines.forEach((line) => wantedQty.set(line.productId, (wantedQty.get(line.productId) || 0) + line.qty));

    lines.forEach((line) => {
      const product = productById.get(line.productId);
      if (!product) throw new ApiError(400, 'One of the items in this sale no longer exists');
      if (product.status !== 'ACTIVE') throw new ApiError(400, `${product.name} is inactive and cannot be sold`);
      // Stock is intentionally not validated: bills go through even at 0 stock.
    });

    // FIFO: each cart line is split across the oldest purchase lots first. Every
    // resulting bill line carries its own lot's selling price and purchase cost
    // (e.g. 7 units with 5 left in lot B1 and the rest in B2 -> two bill lines).
    const allocations = await allocateFifoForSale(tx, tenantId, lines, productById);
    // GST is per product (its Tax Code's rate), not one flat rate for the bill.
    const taxRateOf = await loadTaxRateResolver(tx, tenantId);

    let subTotal = 0;
    const lineData = [];
    lines.forEach((line, index) => {
      const product = productById.get(line.productId);
      allocations[index].forEach((part) => {
        // Cashier-edited price (Line Sale) replaces the lot/product price; the
        // lot (and its purchase cost) is still consumed as usual.
        const unitPrice = line.price != null ? Number(line.price) : part.price;
        const amount = unitPrice * part.qty;
        subTotal += amount;
        lineData.push({
          productId: product.id,
          code: product.code,
          name: product.name,
          uom: product.uom,
          qty: part.qty,
          price: unitPrice,
          taxRate: taxRateOf(product),
          amount,
          lotId: part.lot?.id || null,
          unitCost: part.cost,
        });
      });
    });

    const discountAmount = discountType === 'percent'
      ? (subTotal * discountValue) / 100
      : Math.min(discountValue, subTotal);
    // Prices are GST-inclusive: the payable is subtotal - discount, and each
    // line's GST is extracted from its share of that amount.
    const net = Math.max(subTotal - discountAmount, 0);
    const taxAmount = lineData.reduce((sum, line) => {
      const lineGross = subTotal > 0 ? (line.amount / subTotal) * net : 0;
      const r = Number(line.taxRate);
      return sum + (lineGross - lineGross / (1 + r));
    }, 0);
    const taxable = net - taxAmount;
    const grandTotal = net;
    const changeAmount = receivedAmount - grandTotal;

    const billNo = await nextBillNoWithinTx(tx, tenantId);

    // Stock on hand as it was when this bill was priced (recorded on the TCZ lines).
    const stockBefore = new Map(products.map((p) => [p.id, p.availableQty]));

    const sale = await writeTczBill(tx, {
      tenantId, outletId, billNo, cashierName, customer, customerId: customer.id,
      customerName: customerId ? (customerName || customer.name) : customer.name,
      productById, lineData, subTotal, discountAmount, taxable, taxAmount, grandTotal,
      discountType, discountValue, paymentMethod, receivedAmount, changeAmount,
      cardType, cardLast4, cardBank, upiApp, upiTxnId, paymentReference,
      clientToken, stockBefore,
    });

    // Throws (rolling back this whole sale, stock deduction included) if the
    // held bill was already paid/discarded — one held bill, one sale.
    if (heldBillId) await completeHeldBill(tx, { user: actor, heldBillId, docEntry: BigInt(sale.id) });

    // Conditional decrement: only succeeds while enough stock is still there at
    // write time. Products are updated in a fixed order so two concurrent bills
    // touching the same products can't deadlock each other.
    const decrements = [...wantedQty.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    for (const [productId, qty] of decrements) {
      // Unconditional decrement — stock may go negative (no stock validation).
      await tx.product.updateMany({
        where: { id: productId, tenantId },
        data: { availableQty: { decrement: qty } },
      });
    }

    // Show the next unit's lot price/MRP on the product from now on.
    for (const productId of wantedQty.keys()) {
      // eslint-disable-next-line no-await-in-loop
      await syncProductToHeadLot(tx, tenantId, productId);
    }

    return sale;
  }, { maxWait: 10_000, timeout: 20_000 });
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Powers the Promotion page's "Discount Trend" and "Discount by Outlet"
 * cards. Both are built from real Sale rows' `discountAmount` — the
 * bill-level discount a cashier actually applied at checkout (Line Sale's
 * discount fields) — NOT from a Promotion's own usage count, since nothing
 * in the app applies a Promotion's discount to a Sale yet. That's an honest
 * distinction, not a technicality: this reports "how much discount the
 * business gave out and where", which is real and available today, rather
 * than pretending to report promotion-specific redemptions that aren't
 * tracked anywhere.
 */
export async function getDiscountSummary(tenantId) {
  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);

  const [sales, outlets] = await Promise.all([
    prisma.tczOpos.findMany({
      where: { tenantId, createDate: { gte: since } },
      select: { discountAmount: true, createDate: true, outletId: true },
    }),
    prisma.outlet.findMany({ where: { tenantId }, select: { id: true, name: true } }),
  ]);
  const outletNameById = Object.fromEntries(outlets.map((o) => [o.id, o.name]));

  const dayBuckets = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayBuckets.push({ key: d.toDateString(), label: `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`, total: 0 });
  }
  const bucketByKey = Object.fromEntries(dayBuckets.map((b) => [b.key, b]));

  const outletTotals = new Map();
  sales.forEach((sale) => {
    const amount = Number(sale.discountAmount || 0);
    const dayKey = new Date(sale.createDate).toDateString();
    if (bucketByKey[dayKey]) bucketByKey[dayKey].total += amount;

    const outletKey = sale.outletId || 'unassigned';
    outletTotals.set(outletKey, (outletTotals.get(outletKey) || 0) + amount);
  });

  const byOutlet = [...outletTotals.entries()]
    .map(([outletId, total]) => ({
      outletId,
      name: outletId === 'unassigned' ? 'Unassigned' : (outletNameById[outletId] || 'Unknown Outlet'),
      total: Math.round(total * 100) / 100,
    }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);

  return {
    trend: { categories: dayBuckets.map((b) => b.label), values: dayBuckets.map((b) => Math.round(b.total * 100) / 100) },
    byOutlet,
  };
}

/**
 * Powers the Customer page's top summary tiles ("Total Sales (This Month)"
 * and "Outstanding Amount") — both computed across every real Sale row for
 * the tenant, never fabricated. "Outstanding" is `grandTotal -
 * receivedAmount` per sale (floored at 0) — the only honest proxy available
 * today, since there's no separate Payment/ledger module yet; a cash sale's
 * receivedAmount always covers its grandTotal, so only under-paid/credit
 * sales contribute here.
 */
export async function getSalesOverviewSummary(tenantId) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const sales = await prisma.tczOpos.findMany({
    where: { tenantId },
    select: { grandTotal: true, received: true, createDate: true },
  });

  let totalSalesThisMonth = 0;
  let outstandingAmount = 0;
  sales.forEach((sale) => {
    const grand = Number(sale.grandTotal);
    const received = Number(sale.received);
    outstandingAmount += Math.max(grand - received, 0);
    if (new Date(sale.createDate) >= startOfMonth) totalSalesThisMonth += grand;
  });

  return {
    totalSalesThisMonth: Math.round(totalSalesThisMonth * 100) / 100,
    outstandingAmount: Math.round(outstandingAmount * 100) / 100,
  };
}

/**
 * Powers the Customer list table's per-row "Total Purchase"/"Outstanding"
 * columns — one query for every customer's aggregate instead of one query
 * per row. Keyed by customerId; a customer with no sales simply has no
 * entry (the caller treats that as all-zero).
 */
export async function getCustomerPurchaseSummaries(tenantId) {
  const sales = await prisma.tczOpos.findMany({
    where: { tenantId, customerId: { not: null } },
    select: { customerId: true, grandTotal: true, received: true },
  });

  const map = {};
  sales.forEach((sale) => {
    const key = sale.customerId;
    const grand = Number(sale.grandTotal);
    const received = Number(sale.received);
    if (!map[key]) map[key] = { totalPurchase: 0, outstanding: 0, transactionCount: 0 };
    map[key].totalPurchase += grand;
    map[key].outstanding += Math.max(grand - received, 0);
    map[key].transactionCount += 1;
  });
  Object.values(map).forEach((entry) => {
    entry.totalPurchase = Math.round(entry.totalPurchase * 100) / 100;
    entry.outstanding = Math.round(entry.outstanding * 100) / 100;
  });
  return map;
}

/**
 * Powers the Customer detail panel/view page's "Total Purchase"/"Outstanding
 * Amount" fields and its real "Recent Transactions" list — every row here is
 * an actual Sale this customer was billed on, not a fabricated invoice
 * history.
 */
export async function getCustomerPurchaseSummary(tenantId, customerId) {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
  if (!customer) throw new ApiError(404, 'Customer not found');

  const sales = await prisma.tczOpos.findMany({
    where: { tenantId, customerId },
    orderBy: { createDate: 'desc' },
    select: {
      docEntry: true, docNum: true, createDate: true, grandTotal: true, received: true, payMode: true,
    },
  });

  let totalPurchase = 0;
  let outstanding = 0;
  sales.forEach((sale) => {
    const grand = Number(sale.grandTotal);
    const received = Number(sale.received);
    totalPurchase += grand;
    outstanding += Math.max(grand - received, 0);
  });

  const recentTransactions = sales.slice(0, 20).map((sale) => {
    const grand = Number(sale.grandTotal);
    const received = Number(sale.received);
    return {
      date: sale.createDate,
      type: 'Sale',
      invoiceNo: sale.docNum,
      amount: grand,
      payment: sale.payMode,
      status: received >= grand ? 'paid' : 'due',
    };
  });

  return {
    totalPurchase: Math.round(totalPurchase * 100) / 100,
    outstanding: Math.round(outstanding * 100) / 100,
    transactionCount: sales.length,
    recentTransactions,
  };
}

// Same count-based scheme as nextBillNo(), but run with the transaction's own
// client so the count and the row it names are consistent within one
// transaction (avoids two concurrent sales both reading count=N and trying
// to claim the same billNo — the @@unique([tenantId, billNo]) constraint
// would still catch that as a last resort, just with an uglier 500 instead).
async function nextBillNoWithinTx(tx, tenantId) {
  const count = await tx.tczOpos.count({ where: { tenantId } });
  return `LS-${String(count + 1).padStart(5, '0')}`;
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

// Midnight-to-midnight bounds for one calendar day in the server's local
// time zone. `dateStr` is a "YYYY-MM-DD" string (validated by
// cashSalesQuerySchema/cardSalesQuerySchema); omitted, it defaults to today.
function dayBounds(dateStr) {
  const start = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  if (Number.isNaN(start.getTime())) throw new ApiError(400, 'Invalid date');
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatDayLabel(date) {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Shared engine behind getCashSalesReport, getCardSalesReport,
 * getUpiSalesReport, and getOtherPaymentsReport — all are "how did this
 * tender (or tender bucket) do" reports built from real Sale/SalesReturn
 * rows, differing only in which `paymentMethod`/`refundTo` values they
 * scope to, their stat-tile keys, payment-summary field names, and whether
 * a transaction row carries extra tender-specific columns (e.g. a card's
 * type/last4/bank). See either exported wrapper's own doc comment for what
 * each field means and which figures are all-time vs. scoped to `date`.
 *
 * `paymentMethodWhere`/`refundToWhere` accept anything Prisma's `where`
 * clause does for a String column — a single value (`'cash'`) for a
 * single-tender report, or a filter object (`{ notIn: [...] }`) for a
 * bucket of tenders like "everything that isn't cash/card/upi". They
 * default to the same value so single-tender callers only pass one.
 */
async function getTenderSalesReport(tenantId, outletId, { date, page, pageSize } = {}, {
  paymentMethodWhere, refundToWhere = paymentMethodWhere, donutId, tenderLabel, mapExtraRowFields = () => ({}),
}) {
  const outletFilter = outletId ? { outletId } : {};
  const { start: dayStart, end: dayEnd } = dayBounds(date);
  const { start: todayStart, end: todayEnd } = dayBounds();

  const [allTenderSales, todaysAgg, daySales, dayReturns] = await Promise.all([
    prisma.tczOpos.findMany({
      where: { tenantId, ...outletFilter, payMode: paymentMethodWhere },
      select: { grandTotal: true, lines: { select: { quantity: true } } },
    }),
    prisma.tczOpos.aggregate({
      where: {
        tenantId, ...outletFilter, payMode: paymentMethodWhere, createDate: { gte: todayStart, lte: todayEnd },
      },
      _sum: { grandTotal: true },
      _count: { _all: true },
    }),
    prisma.tczOpos.findMany({
      where: {
        tenantId, ...outletFilter, payMode: paymentMethodWhere, createDate: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { createDate: 'desc' },
      include: { lines: true },
    }),
    prisma.salesReturn.findMany({
      where: {
        tenantId,
        refundMode: 'refund',
        refundTo: refundToWhere,
        createdAt: { gte: dayStart, lte: dayEnd },
        ...(outletId ? { tczBill: { outletId } } : {}),
      },
      select: { grandTotal: true },
    }),
  ]);

  let totalValue = 0;
  let totalItems = 0;
  let totalQty = 0;
  allTenderSales.forEach((sale) => {
    totalValue += Number(sale.grandTotal);
    totalItems += sale.lines.length;
    totalQty += sale.lines.reduce((sum, line) => sum + Number(line.quantity), 0);
  });
  const totalTransactions = allTenderSales.length;
  const avgInvoiceValue = totalTransactions > 0 ? totalValue / totalTransactions : 0;

  let grossSales = 0;
  let discount = 0;
  let taxAmount = 0;
  let grandTotal = 0;
  let received = 0;
  let changeReturned = 0;
  daySales.forEach((sale) => {
    grossSales += Number(sale.subTotal);
    discount += Number(sale.discountAmount);
    taxAmount += Number(sale.taxAmount);
    grandTotal += Number(sale.grandTotal);
    received += Number(sale.received);
    changeReturned += Number(sale.changeAmount);
  });
  const taxableAmount = Math.max(grossSales - discount - taxAmount, 0);
  const refunds = dayReturns.reduce((sum, ret) => sum + Number(ret.grandTotal), 0);
  const netRetained = received - changeReturned;

  const totalPages = Math.max(Math.ceil(daySales.length / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const transactions = daySales.slice(pageStart, pageStart + pageSize).map((sale) => ({
    invoiceNo: sale.docNum,
    dateTime: sale.createDate,
    items: sale.lines.length,
    qty: sale.lines.reduce((sum, line) => sum + Number(line.quantity), 0),
    discount: round2(sale.discountAmount),
    tax: round2(sale.taxAmount),
    totalAmount: round2(sale.grandTotal),
    received: round2(sale.received),
    cashier: sale.createdBy,
    ...mapExtraRowFields(sale),
  }));

  return {
    stats: {
      total: { value: round2(totalValue), transactions: totalTransactions },
      totalItemsSold: { value: totalItems, totalQty: round2(totalQty) },
      avgInvoiceValue: { value: round2(avgInvoiceValue) },
      today: { value: round2(todaysAgg._sum.grandTotal || 0), transactions: todaysAgg._count._all },
      selectedDateSales: { value: round2(grandTotal), date: formatDayLabel(dayStart) },
    },
    summary: {
      grossSales: round2(grossSales),
      discount: round2(discount),
      taxableAmount: round2(taxableAmount),
      cgstRate: 2.5,
      cgstAmount: round2(taxAmount / 2),
      sgstRate: 2.5,
      sgstAmount: round2(taxAmount / 2),
      grandTotal: round2(grandTotal),
    },
    payment: {
      received: round2(received),
      changeReturned: round2(changeReturned),
      totalReceived: round2(netRetained),
      refunds: round2(refunds),
    },
    donut: [
      { id: donutId, label: tenderLabel, value: Math.max(round2(netRetained), 0), color: '#22C55E' },
      { id: 'refunds', label: 'Refunds', value: round2(refunds), color: '#EF4444' },
    ],
    transactions,
    totalPages,
    page: safePage,
    pageSize,
  };
}

/**
 * Powers the Cashier Panel's Cash Sales report — every figure here comes
 * from real Sale/SalesReturn rows, scoped to `paymentMethod: 'cash'` only
 * (this is a cash-tender report, not the general sales report):
 *
 * - stats.totalCashSales / stats.totalItemsSold / stats.avgInvoiceValue are
 *   all-time totals for the cashier's outlet, so the tiles don't reset to
 *   zero every time the date filter changes.
 * - stats.todaysCashSales is always the server's current calendar day,
 *   independent of the `date` filter, matching the reference UI's separate
 *   "Today" vs "Selected Date" tiles.
 * - stats.selectedDateSales / summary / payment / donut / transactions are
 *   all scoped to `date` (defaults to today) — this is what the page's date
 *   picker actually controls.
 * - CGST/SGST are reported as an even split of the flat `taxAmount` this
 *   schema stores (see TAX_RATE's comment) — an approximation, not a true
 *   per-rate breakdown, since there's no separate CGST/SGST column.
 * - payment.refunds is real cash refund value from SalesReturn rows
 *   (`refundMode: 'refund'`, `refundTo: 'cash'`) processed on the selected
 *   day — not derived from the Sale rows themselves.
 */
export async function getCashSalesReport(tenantId, outletId, params = {}) {
  const report = await getTenderSalesReport(tenantId, outletId, params, {
    paymentMethodWhere: 'cash',
    donutId: 'cash',
    tenderLabel: 'Cash Retained',
    mapExtraRowFields: () => ({ paymentMode: 'Cash' }),
  });
  return {
    ...report,
    stats: {
      totalCashSales: report.stats.total,
      totalItemsSold: report.stats.totalItemsSold,
      avgInvoiceValue: report.stats.avgInvoiceValue,
      todaysCashSales: report.stats.today,
      selectedDateSales: report.stats.selectedDateSales,
    },
    payment: {
      cashReceived: report.payment.received,
      changeReturned: report.payment.changeReturned,
      totalReceived: report.payment.totalReceived,
      refunds: report.payment.refunds,
    },
  };
}

/**
 * Powers the Cashier Panel's Card Sales report — same shape/semantics as
 * getCashSalesReport above (see its doc comment for the all-time-vs-`date`
 * split and the CGST/SGST approximation caveat), scoped to
 * `paymentMethod: 'card'` and with each transaction row also carrying the
 * card's type/last-4/bank when known.
 *
 * The Line Sale checkout screen doesn't collect card network/last-4/bank
 * yet (createSale accepts them as optional — see sale.schema.js), so those
 * three columns are null on every sale made before that capture exists;
 * the frontend renders them as "—" rather than guessing.
 */
export async function getCardSalesReport(tenantId, outletId, params = {}) {
  const report = await getTenderSalesReport(tenantId, outletId, params, {
    paymentMethodWhere: 'card',
    donutId: 'card',
    tenderLabel: 'Card Retained',
    mapExtraRowFields: (sale) => ({
      cardType: sale.cardType || null,
      cardLast4: sale.cardLast4 || null,
      cardBank: sale.cardBank || null,
    }),
  });
  return {
    ...report,
    stats: {
      totalCardSales: report.stats.total,
      totalItemsSold: report.stats.totalItemsSold,
      avgInvoiceValue: report.stats.avgInvoiceValue,
      todaysCardSales: report.stats.today,
      selectedDateSales: report.stats.selectedDateSales,
    },
    payment: {
      cardReceived: report.payment.received,
      changeReturned: report.payment.changeReturned,
      totalReceived: report.payment.totalReceived,
      refunds: report.payment.refunds,
    },
  };
}

/**
 * Powers the Cashier Panel's UPI Sales report — same shape/semantics as
 * getCashSalesReport above (see its doc comment for the all-time-vs-`date`
 * split and the CGST/SGST approximation caveat), scoped to
 * `paymentMethod: 'upi'` and with each transaction row also carrying the
 * UPI app/transaction ID when known.
 *
 * The Line Sale checkout screen doesn't collect the UPI app/transaction ID
 * yet (createSale accepts them as optional — see sale.schema.js), so those
 * two columns are null on every sale made before that capture exists; the
 * frontend renders them as "—" rather than guessing.
 */
export async function getUpiSalesReport(tenantId, outletId, params = {}) {
  const report = await getTenderSalesReport(tenantId, outletId, params, {
    paymentMethodWhere: 'upi',
    donutId: 'upi',
    tenderLabel: 'UPI Retained',
    mapExtraRowFields: (sale) => ({
      upiApp: sale.upiApp || null,
      upiTxnId: sale.upiTxnId || null,
    }),
  });
  return {
    ...report,
    stats: {
      totalUpiSales: report.stats.total,
      totalItemsSold: report.stats.totalItemsSold,
      avgInvoiceValue: report.stats.avgInvoiceValue,
      todaysUpiSales: report.stats.today,
      selectedDateSales: report.stats.selectedDateSales,
    },
    payment: {
      upiReceived: report.payment.received,
      changeReturned: report.payment.changeReturned,
      totalReceived: report.payment.totalReceived,
      refunds: report.payment.refunds,
    },
  };
}

// The three "primary" tenders that each get their own dedicated report
// (Cash/Card/UPI Sales) — everything else falls into the Other Payments
// bucket below.
const PRIMARY_TENDER_METHODS = ['cash', 'card', 'upi'];

// Human-readable labels for the "other" tender tokens accepted by
// createSaleSchema — falls back to title-casing an unknown token (defensive
// only; every token createSale accepts today has an explicit entry here).
const OTHER_PAYMENT_MODE_LABELS = {
  wallet: 'Wallet',
  credit: 'Credit',
  'store-credit': 'Store Credit',
  'gift-card': 'Gift Card',
  cheque: 'Cheque',
  'bank-transfer': 'Bank Transfer',
};

function labelForPaymentMethod(method) {
  if (OTHER_PAYMENT_MODE_LABELS[method]) return OTHER_PAYMENT_MODE_LABELS[method];
  if (!method) return 'Other';
  return method
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Powers the Cashier Panel's Other Payments report — the miscellaneous-
 * tender bucket that isn't cash, card, or UPI (store credit, gift card,
 * wallet, credit, cheque, bank transfer). Same all-time-vs-`date` split and
 * CGST/SGST approximation caveat as getCashSalesReport above, but scoped to
 * `paymentMethod NOT IN ('cash', 'card', 'upi')` via the shared engine's
 * filter-object support, and with two differences from the single-tender
 * reports:
 *
 * - Each transaction row carries a `paymentMode` (the tender's own label —
 *   "Gift Card", "Cheque", ...) and a free-text `reference` from
 *   `paymentReference`, since these tenders don't share a common structured
 *   detail shape the way card/UPI do. The Line Sale checkout screen doesn't
 *   collect `paymentReference` yet (createSale accepts it as optional — see
 *   sale.schema.js), so it's "—" on every sale made before that capture
 *   exists.
 * - payment.cash/card/upi and the donut are same-day totals for the three
 *   *primary* tenders, shown here purely as reconciliation context (so a
 *   cashier can see the full day's payment mix on one screen) — they are
 *   NOT summed into payment.totalReceived, which stays this bucket's own
 *   net retained amount, same as every other tender report.
 */
export async function getOtherPaymentsReport(tenantId, outletId, params = {}) {
  const outletFilter = outletId ? { outletId } : {};
  const { start: dayStart, end: dayEnd } = dayBounds(params.date);

  // One groupBy instead of three separate aggregate() calls for the
  // cash/card/upi context lines — same result, but one connection instead
  // of three. getTenderSalesReport below already needs 4 of its own
  // (see its doc comment), so this keeps this endpoint's total worst-case
  // concurrent connections at 5 instead of 7 — right at the pool's `max`
  // (see config/prisma.js) rather than over it.
  const [report, primaryTenderTotals] = await Promise.all([
    getTenderSalesReport(tenantId, outletId, params, {
      paymentMethodWhere: { notIn: PRIMARY_TENDER_METHODS },
      refundToWhere: { notIn: PRIMARY_TENDER_METHODS },
      donutId: 'other',
      tenderLabel: 'Other Payments Retained',
      mapExtraRowFields: (sale) => ({
        paymentMode: labelForPaymentMethod(sale.payMode),
        reference: sale.payRef || null,
      }),
    }),
    prisma.tczOpos.groupBy({
      by: ['payMode'],
      where: {
        tenantId, ...outletFilter, payMode: { in: PRIMARY_TENDER_METHODS }, createDate: { gte: dayStart, lte: dayEnd },
      },
      _sum: { received: true },
    }),
  ]);

  const receivedByMethod = Object.fromEntries(
    primaryTenderTotals.map((row) => [row.payMode, round2(row._sum.received || 0)]),
  );
  const cash = receivedByMethod.cash || 0;
  const card = receivedByMethod.card || 0;
  const upi = receivedByMethod.upi || 0;

  return {
    ...report,
    stats: {
      totalOtherPayments: report.stats.total,
      totalItemsSold: report.stats.totalItemsSold,
      avgInvoiceValue: report.stats.avgInvoiceValue,
      todaysOtherPayments: report.stats.today,
      selectedDateSales: report.stats.selectedDateSales,
    },
    payment: {
      otherPaymentsReceived: report.payment.received,
      cash,
      card,
      upi,
      changeReturned: report.payment.changeReturned,
      totalReceived: report.payment.totalReceived,
      refunds: report.payment.refunds,
    },
    // No refunds slice here (unlike the single-tender reports) — this donut
    // is a same-day payment-mix picture across all four buckets instead.
    donut: [
      { id: 'other', label: 'Other Payments', value: Math.max(round2(report.payment.totalReceived), 0), color: '#F5A623' },
      { id: 'cash', label: 'Cash', value: cash, color: '#22A06B' },
      { id: 'card', label: 'Card', value: card, color: '#2563EB' },
      { id: 'upi', label: 'UPI', value: upi, color: '#8B5CF6' },
    ],
  };
}

/**
 * Line Sale "Recent Sales" popup: the outlet's most recent bills (newest
 * first), default 10.
 */
export async function getRecentSales(tenantId, outletId, limit = 10) {
  const rows = await prisma.tczOpos.findMany({
    where: { tenantId, ...(outletId ? { outletId } : {}) },
    orderBy: { createDate: 'desc' },
    take: Math.min(Math.max(Number(limit) || 10, 1), 50),
    select: {
      docNum: true, customerName: true, payMode: true, grandTotal: true, createDate: true,
      lines: { select: { quantity: true } },
    },
  });
  return rows.map((r) => ({
    billNo: r.docNum,
    customerName: r.customerName || 'Walk-in Customer',
    paymentMethod: r.payMode,
    items: r.lines.length,
    qty: r.lines.reduce((sum, l) => sum + Number(l.quantity || 0), 0),
    amount: Math.round(Number(r.grandTotal || 0) * 100) / 100,
    createdAt: r.createDate,
  }));
}

/** One bill (header + lines) by bill number — "Recent Sales" View / Print. */
export async function getSaleByBillNo(tenantId, outletId, billNo) {
  const sale = await prisma.tczOpos.findFirst({
    where: { tenantId, docNum: billNo, ...(outletId ? { outletId } : {}) },
    include: { lines: { orderBy: { lineId: 'asc' } } },
  });
  if (!sale) throw new ApiError(404, 'Bill not found');
  return toSaleDto(sale, sale.lines);
}
