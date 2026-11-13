import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../middleware/errorHandler.js';

/**
 * Inventory Reports (Reports > Inventory Reports). Every report here is
 * read-only and derived from real rows already written by the Product /
 * Batch-Serial / Stock Wastage / Stock Count / Stock Receipt / Stock Return /
 * Sales modules — there is no "reports" table of its own, same convention as
 * the Shift-to-Shift Variance and Dashboard reports.
 *
 * Product.availableQty is a single tenant-wide running counter (see that
 * field's own doc comment) — this schema has no per-warehouse stock ledger,
 * so Current Stock / Low Stock / Out-of-Stock / Stock Valuation cannot be
 * split by warehouse or outlet; only Batch Expiry (BatchSerial has a real
 * warehouseId FK) and Wastage (StockWastage has a real outletId) can be.
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

export async function listInventoryReportFilters(user) {
  const mayChoose = user.role === 'ADMIN';
  const [outlets, warehouses] = await Promise.all([
    prisma.outlet.findMany({
      where: { tenantId: user.tenantId, ...(mayChoose ? {} : { id: user.outletId || '' }) },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    }),
    prisma.warehouse.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  return { outlets, warehouses, canChooseOutlet: mayChoose };
}

// ---------------------------------------------------------------------------
// Current Stock / Low Stock / Out-of-Stock / Stock Valuation — all four read
// the same Product snapshot (see dashboard.service.js's getProductInventory,
// which this mirrors) and differ only in which bucket they keep.
// ---------------------------------------------------------------------------

function stockStatusOf(p) {
  if (p.availableQty <= 0) return 'OUT_OF_STOCK';
  if (p.availableQty <= p.reorderLevel) return 'LOW_STOCK';
  return 'IN_STOCK';
}

async function fetchProductSnapshot(tenantId) {
  return prisma.product.findMany({
    where: { tenantId, status: 'ACTIVE' },
    select: {
      id: true, code: true, name: true, group: true, brand: true, uom: true, availableQty: true, reorderLevel: true, salePrice: true, mrp: true,
    },
    orderBy: { name: 'asc' },
  });
}

async function stockLevelReport(user, query, bucketFilter) {
  const products = await fetchProductSnapshot(user.tenantId);
  const rows = products
    .filter((p) => matchesSearch(`${p.code} ${p.name}`, query.search))
    .filter(bucketFilter)
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      group: p.group,
      brand: p.brand || '—',
      uom: p.uom,
      availableQty: p.availableQty,
      reorderLevel: p.reorderLevel,
      salePrice: round2(p.salePrice),
      mrp: round2(p.mrp),
      stockValue: round2(n(p.availableQty) * n(p.salePrice)),
      status: stockStatusOf(p),
    }));

  const summary = {
    totalItems: rows.length,
    totalQty: rows.reduce((s, r) => s + r.availableQty, 0),
    totalValue: round2(rows.reduce((s, r) => s + r.stockValue, 0)),
  };
  return { summary, ...paginate(rows, query.page, query.pageSize) };
}

export async function getCurrentStockReport(user, query) {
  return stockLevelReport(user, query, () => true);
}

export async function getLowStockReport(user, query) {
  return stockLevelReport(user, query, (p) => p.availableQty > 0 && p.availableQty <= p.reorderLevel);
}

export async function getOutOfStockReport(user, query) {
  return stockLevelReport(user, query, (p) => p.availableQty <= 0);
}

export async function getStockValuationReport(user, query) {
  return stockLevelReport(user, query, () => true);
}

// ---------------------------------------------------------------------------
// Batch Expiry — real BatchSerial rows, the only stock-level model with a
// genuine warehouse FK.
// ---------------------------------------------------------------------------

export async function getBatchExpiryReport(user, query) {
  const where = { tenantId: user.tenantId, status: 'ACTIVE' };
  if (query.warehouseId) where.warehouseId = query.warehouseId;

  const batches = await prisma.batchSerial.findMany({
    where,
    select: {
      id: true,
      number: true,
      type: true,
      mfgDate: true,
      expiryDate: true,
      qty: true,
      uom: true,
      product: { select: { code: true, name: true } },
      warehouse: { select: { name: true } },
    },
    orderBy: { expiryDate: 'asc' },
  });

  const now = new Date();
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 30);

  const withStatus = batches.map((b) => {
    let expiryStatus = 'NO_EXPIRY';
    if (b.expiryDate) {
      if (new Date(b.expiryDate) < now) expiryStatus = 'EXPIRED';
      else if (new Date(b.expiryDate) <= soon) expiryStatus = 'EXPIRING_SOON';
      else expiryStatus = 'ACTIVE';
    }
    return {
      id: b.id,
      batchNo: b.number,
      type: b.type,
      productCode: b.product?.code || '—',
      productName: b.product?.name || '—',
      warehouse: b.warehouse?.name || '—',
      mfgDate: b.mfgDate,
      expiryDate: b.expiryDate,
      qty: n(b.qty),
      uom: b.uom,
      expiryStatus,
    };
  });

  const statusMatches = (b) => {
    if (query.status === 'all') return true;
    if (query.status === 'expired') return b.expiryStatus === 'EXPIRED';
    if (query.status === 'expiring-soon') return b.expiryStatus === 'EXPIRING_SOON';
    return b.expiryStatus === 'ACTIVE';
  };

  const rows = withStatus
    .filter((b) => matchesSearch(`${b.productCode} ${b.productName} ${b.batchNo}`, query.search))
    .filter(statusMatches);

  const summary = {
    totalBatches: rows.length,
    expired: withStatus.filter((b) => b.expiryStatus === 'EXPIRED').length,
    expiringSoon: withStatus.filter((b) => b.expiryStatus === 'EXPIRING_SOON').length,
  };
  return { summary, ...paginate(rows, query.page, query.pageSize) };
}

// ---------------------------------------------------------------------------
// Wastage — real StockWastage + StockWastageItem rows.
// ---------------------------------------------------------------------------

export async function getWastageReport(user, query) {
  const range = resolveDateRange(query.from, query.to, 30);
  const outletIds = await resolveOutletIds(user, query.outletId);

  const wastages = await prisma.stockWastage.findMany({
    where: {
      tenantId: user.tenantId, outletId: { in: outletIds }, wastageDate: { gte: range.start, lte: range.end },
    },
    include: { items: true },
    orderBy: { wastageDate: 'desc' },
  });

  const rows = wastages.flatMap((w) => w.items.map((it) => ({
    id: it.id,
    wastageCode: w.code,
    wastageDate: w.wastageDate,
    outletName: w.outletName,
    wastageType: w.wastageType,
    itemCode: it.itemCode,
    itemName: it.itemName,
    uom: it.uom || '—',
    qty: n(it.wastageQty),
    unitCost: round2(it.unitCost),
    totalValue: round2(it.totalValue),
    status: w.status,
  }))).filter((r) => matchesSearch(`${r.itemCode} ${r.itemName} ${r.wastageCode}`, query.search));

  const summary = {
    totalRecords: wastages.length,
    totalQty: round2(rows.reduce((s, r) => s + r.qty, 0)),
    totalValue: round2(rows.reduce((s, r) => s + r.totalValue, 0)),
  };
  return {
    range: { from: range.from, to: range.to }, summary, ...paginate(rows, query.page, query.pageSize),
  };
}

// ---------------------------------------------------------------------------
// Stock Adjustment vs. Physical Stock Variance — both read StockCount /
// StockCountItem (the only "counted vs system qty" record this schema has).
// Physical Stock Variance shows every counted line with a variance,
// regardless of whether the count was finalized; Stock Adjustment narrows
// that to counts already finalized (status: 'completed') — i.e. the
// variance has actually been applied/accepted, not just observed.
// ---------------------------------------------------------------------------

async function countVarianceReport(user, query, statusFilter) {
  const range = resolveDateRange(query.from, query.to, 30);
  const where = { tenantId: user.tenantId, countDate: { gte: range.start, lte: range.end } };
  if (query.warehouse) where.warehouse = query.warehouse;
  if (statusFilter) where.status = statusFilter;

  const counts = await prisma.stockCount.findMany({
    where, include: { items: true }, orderBy: { countDate: 'desc' },
  });

  const rows = counts.flatMap((c) => c.items
    .filter((it) => n(it.varianceQty) !== 0)
    .map((it) => ({
      id: it.id,
      countCode: c.code,
      countDate: c.countDate,
      warehouse: c.warehouse,
      status: c.status,
      itemCode: it.itemCode,
      itemName: it.itemName,
      uom: it.uom || '—',
      systemQty: n(it.systemQty),
      countedQty: n(it.countedQty),
      varianceQty: n(it.varianceQty),
      varianceValue: round2(it.varianceValue),
    })))
    .filter((r) => matchesSearch(`${r.itemCode} ${r.itemName} ${r.countCode}`, query.search));

  const summary = {
    totalRecords: rows.length,
    shortageValue: round2(rows.filter((r) => r.varianceQty < 0).reduce((s, r) => s + Math.abs(r.varianceValue), 0)),
    excessValue: round2(rows.filter((r) => r.varianceQty > 0).reduce((s, r) => s + r.varianceValue, 0)),
  };
  return {
    range: { from: range.from, to: range.to }, summary, ...paginate(rows, query.page, query.pageSize),
  };
}

export async function getStockAdjustmentReport(user, query) {
  return countVarianceReport(user, query, 'completed');
}

export async function getPhysicalStockVarianceReport(user, query) {
  return countVarianceReport(user, query, undefined);
}

// ---------------------------------------------------------------------------
// Slow Moving / Fast Moving Items — real LinesaleItemDetails (TczPos1)
// quantity sold per product over the period, same groupBy the Dashboard's
// Top Selling Items panel already uses, ranked ascending (slow) or
// descending (fast). A product with zero completed sales in the period is
// real "slow moving" data, not a gap, so it's included with qtySold: 0.
// ---------------------------------------------------------------------------

async function movementRankingReport(user, query, direction) {
  const range = resolveDateRange(query.from, query.to, 30);
  const tenantId = user.tenantId;

  const grouped = await prisma.tczPos1.groupBy({
    by: ['productId'],
    where: {
      productId: { not: null },
      header: {
        tenantId, docStatus: 'COMPLETED', createDate: { gte: range.start, lte: range.end },
      },
    },
    _sum: { quantity: true, lineTotal: true },
  });
  const soldByProduct = new Map(grouped.map((g) => [g.productId, g]));

  const products = await prisma.product.findMany({
    where: { tenantId, status: 'ACTIVE' },
    select: {
      id: true, code: true, name: true, uom: true, availableQty: true,
    },
  });

  const rows = products
    .map((p) => {
      const g = soldByProduct.get(p.id);
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        uom: p.uom,
        availableQty: p.availableQty,
        qtySold: n(g?._sum.quantity),
        salesValue: round2(g?._sum.lineTotal),
      };
    })
    .filter((r) => matchesSearch(`${r.code} ${r.name}`, query.search));

  rows.sort((a, b) => (direction === 'fast' ? b.qtySold - a.qtySold : a.qtySold - b.qtySold));

  const summary = {
    rangeDays: Math.round((range.end - range.start) / 86400000) + 1,
    zeroSaleItems: rows.filter((r) => r.qtySold === 0).length,
  };
  return {
    range: { from: range.from, to: range.to }, summary, ...paginate(rows, query.page, query.pageSize),
  };
}

export async function getSlowMovingReport(user, query) {
  return movementRankingReport(user, query, 'slow');
}

export async function getFastMovingReport(user, query) {
  return movementRankingReport(user, query, 'fast');
}

// ---------------------------------------------------------------------------
// Stock Movement — a unioned ledger of every real stock-affecting event this
// schema can see in the window: goods received (Stock Receipt, IN), goods
// sold (Sale lines, OUT), goods wasted (Stock Wastage, OUT) and goods sent
// back to a supplier (Stock Return, OUT). There is no single stock ledger
// table (Product.availableQty is one running counter — see its own doc
// comment), so this is assembled from each module's own frozen line items,
// not read off a ledger that doesn't exist.
// ---------------------------------------------------------------------------

export async function getStockMovementReport(user, query) {
  const range = resolveDateRange(query.from, query.to, 7);
  const tenantId = user.tenantId;

  const [receiptItems, wastageItems, returnItems, saleLines] = await Promise.all([
    prisma.stockReceiptItem.findMany({
      where: { receipt: { tenantId, receiptDate: { gte: range.start, lte: range.end } } },
      include: { receipt: { select: { code: true, receiptDate: true, supplierName: true } } },
    }),
    prisma.stockWastageItem.findMany({
      where: { stockWastage: { tenantId, wastageDate: { gte: range.start, lte: range.end } } },
      include: { stockWastage: { select: { code: true, wastageDate: true, outletName: true } } },
    }),
    prisma.stockReturnItem.findMany({
      where: { stockReturn: { tenantId, returnDate: { gte: range.start, lte: range.end } } },
      include: { stockReturn: { select: { code: true, returnDate: true, supplierName: true } } },
    }),
    prisma.tczPos1.findMany({
      where: { header: { tenantId, docStatus: 'COMPLETED', createDate: { gte: range.start, lte: range.end } } },
      include: { header: { select: { docNum: true, createDate: true } } },
    }),
  ]);

  const rows = [
    ...receiptItems.map((it) => ({
      id: `receipt-${it.id}`,
      date: it.receipt.receiptDate,
      type: 'IN',
      source: 'Stock Receipt',
      reference: it.receipt.code,
      itemCode: it.itemCode,
      itemName: it.itemName,
      qty: n(it.receivedQty),
      value: round2(it.totalCost),
      party: it.receipt.supplierName,
    })),
    ...wastageItems.map((it) => ({
      id: `wastage-${it.id}`,
      date: it.stockWastage.wastageDate,
      type: 'OUT',
      source: 'Wastage',
      reference: it.stockWastage.code,
      itemCode: it.itemCode,
      itemName: it.itemName,
      qty: -n(it.wastageQty),
      value: -round2(it.totalValue),
      party: it.stockWastage.outletName,
    })),
    ...returnItems.map((it) => ({
      id: `return-${it.id}`,
      date: it.stockReturn.returnDate,
      type: 'OUT',
      source: 'Stock Return',
      reference: it.stockReturn.code,
      itemCode: it.itemCode,
      itemName: it.itemName,
      qty: -n(it.returnedQty),
      value: -round2(it.totalCost),
      party: it.stockReturn.supplierName,
    })),
    ...saleLines.map((it) => ({
      id: `sale-${it.docEntry}-${it.lineId}`,
      date: it.header.createDate,
      type: 'OUT',
      source: 'Sale',
      reference: it.header.docNum,
      itemCode: it.itemCode || '—',
      itemName: it.itemName || '—',
      qty: -n(it.quantity),
      value: -round2(it.lineTotal),
      party: null,
    })),
  ]
    .filter((r) => (query.type === 'all' ? true : (query.type === 'in' ? r.type === 'IN' : r.type === 'OUT')))
    .filter((r) => matchesSearch(`${r.itemCode} ${r.itemName} ${r.reference}`, query.search))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const summary = {
    totalIn: round2(rows.filter((r) => r.type === 'IN').reduce((s, r) => s + r.qty, 0)),
    totalOut: round2(Math.abs(rows.filter((r) => r.type === 'OUT').reduce((s, r) => s + r.qty, 0))),
    netValue: round2(rows.reduce((s, r) => s + r.value, 0)),
  };
  return {
    range: { from: range.from, to: range.to }, summary, ...paginate(rows, query.page, query.pageSize),
  };
}
