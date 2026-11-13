import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { receiveLot } from '../product-lot/productLot.service.js';

const CODE_PREFIX = 'RCPT';
const CODE_LENGTH = 5;

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function nextReceiptCode(tenantId) {
  const count = await prisma.stockReceipt.count({ where: { tenantId } });
  return `${CODE_PREFIX}-${String(count + 1).padStart(CODE_LENGTH, '0')}`;
}

export async function nextCodePreview(tenantId) {
  return nextReceiptCode(tenantId);
}

// supplierId is a plain client-supplied id, not a formal Prisma relation
// (see the StockReceipt model's own comment on why) — so it's validated
// here, against a real Supplier row for this tenant, before ever being
// trusted. Returns the supplier's name for the snapshot column, or throws a
// 400 naming exactly which reference was invalid.
async function assertSupplierIsValid(tx, tenantId, supplierId) {
  const supplier = await tx.supplier.findFirst({ where: { id: supplierId, tenantId } });
  if (!supplier) throw new ApiError(400, 'Supplier references a supplier that does not exist');
  return supplier.name;
}

// Same validated-reference pattern as Stock Indent/Stock Transfer's own
// fromOutletId/toOutletId.
async function assertOutletIsValid(tx, tenantId, outletId, label) {
  const outlet = await tx.outlet.findFirst({ where: { id: outletId, tenantId } });
  if (!outlet) throw new ApiError(400, `${label} references an outlet that does not exist`);
  return outlet.name;
}

// Unlike Stock Indent/Stock Transfer's computeItems, there is no Product-
// master join here — orderedQty/receivedQty/unitCost/discount/tax are all
// the real figures the user typed off the supplier's invoice/GRN, so
// overriding them from a "live" Product price would be the dishonest move,
// not the honest one. What IS recomputed server-side (never trusted from the
// client) is each line's totalCost and the document's aggregate totals,
// using the same formula ReceiptSummaryTotals previews client-side:
// receivedQty * unitCost, less the line discount, plus tax on the
// discounted amount.
function computeItems(items) {
  let totalReceivedQty = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let totalEstimatedValue = 0;

  const rows = items.map((item) => {
    const orderedQty = Number(item.orderedQty) || 0;
    const receivedQty = Number(item.receivedQty);
    const unitCost = Number(item.unitCost) || 0;
    const discountPct = Number(item.discount) || 0;
    const taxPct = Number(item.tax) || 0;

    const base = receivedQty * unitCost;
    const discountAmount = (base * discountPct) / 100;
    const afterDiscount = base - discountAmount;
    const taxAmount = (afterDiscount * taxPct) / 100;
    const totalCost = round2(afterDiscount + taxAmount);

    totalReceivedQty += receivedQty;
    totalDiscount += discountAmount;
    totalTax += taxAmount;
    totalEstimatedValue += totalCost;

    return {
      itemCode: item.itemCode,
      itemName: item.itemName,
      hsnCode: item.hsnCode || null,
      barcode: item.barcode || null,
      uom: item.uom || null,
      orderedQty,
      receivedQty,
      unitCost,
      discount: discountPct,
      tax: taxPct,
      totalCost,
      warehouse: item.warehouse || null,
      batchNo: item.batchNo || null,
      expiryDate: item.expiryDate || null,
      remarks: item.remarks || null,
      mrp: item.mrp == null || item.mrp === '' ? null : Number(item.mrp),
      sellingPrice: item.sellingPrice == null || item.sellingPrice === '' ? null : Number(item.sellingPrice),
    };
  });

  return {
    rows,
    totals: {
      totalItems: rows.length,
      totalReceivedQty: round2(totalReceivedQty),
      totalDiscount: round2(totalDiscount),
      totalTax: round2(totalTax),
      totalEstimatedValue: round2(totalEstimatedValue),
    },
  };
}

export async function listStockReceipts(tenantId, { status, search } = {}) {
  const where = { tenantId };
  // A plain stored status column (no live date-derived state here, unlike
  // Sales Quotation/Invoice's 'expired'/'overdue'), so it can be filtered
  // directly in the query.
  if (status && status !== 'all' && status !== 'All') {
    where.status = String(status).toLowerCase();
  }
  if (search) {
    const q = String(search);
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { supplierName: { contains: q, mode: 'insensitive' } },
      { purchaseInvoiceNo: { contains: q, mode: 'insensitive' } },
    ];
  }

  const rows = await prisma.stockReceipt.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { items: true },
    take: 1000,
  });
  return rows;
}

export async function getStockReceipt(tenantId, id) {
  const row = await prisma.stockReceipt.findFirst({ where: { id, tenantId }, include: { items: true } });
  if (!row) throw new ApiError(404, 'Stock receipt not found');
  return row;
}

// When status is 'received' the receipt has, by definition, just been
// counted in and accepted — so receivedBy/receivedOn are stamped right here,
// the one workflow status this module can actually reach through its own
// create/update endpoint (unlike Stock Indent's approval workflow or Stock
// Transfer's dispatch workflow, both of which still have unreachable
// states).
function receivedFields(status, actor, existing) {
  if (status !== 'received') return { receivedBy: null, receivedOn: null };
  if (existing?.status === 'received') return { receivedBy: existing.receivedBy, receivedOn: existing.receivedOn };
  return { receivedBy: actor?.name || 'Admin', receivedOn: new Date() };
}

// Receiving a receipt is the stock-in event: every line becomes a FIFO purchase
// lot (own MRP / purchase price / selling price) and adds to Product.availableQty.
// Done once, when the receipt first reaches 'received'. Lines whose item code
// matches no product are skipped (the grid is free text). MRP / selling price
// default to the product's current ones when the line leaves them blank.
async function receiveLotsForReceipt(tx, tenantId, receipt) {
  const codes = [...new Set(receipt.items.map((i) => i.itemCode))];
  const products = await tx.product.findMany({ where: { tenantId, code: { in: codes } } });
  const byCode = new Map(products.map((p) => [p.code, p]));
  for (const [index, item] of receipt.items.entries()) {
    const product = byCode.get(item.itemCode);
    const qty = Number(item.receivedQty);
    if (!product || !(qty > 0)) continue; // eslint-disable-line no-continue
    // eslint-disable-next-line no-await-in-loop
    await receiveLot(tx, {
      tenantId,
      productId: product.id,
      lotNo: item.batchNo || `${receipt.code}-${index + 1}`,
      source: 'RECEIPT',
      sourceRef: receipt.code,
      receivedAt: receipt.receivedOn || new Date(),
      mrp: item.mrp != null ? Number(item.mrp) : Number(product.mrp),
      purchasePrice: Number(item.unitCost),
      sellingPrice: item.sellingPrice != null ? Number(item.sellingPrice) : Number(product.salePrice),
      qty,
      expiryDate: item.expiryDate || null,
    });
  }
}

export async function createStockReceipt(tenantId, data, actor) {
  return prisma.$transaction(async (tx) => {
    const code = data.code || (await nextReceiptCode(tenantId));

    const supplierName = await assertSupplierIsValid(tx, tenantId, data.supplierId);
    const fromOutletName = await assertOutletIsValid(tx, tenantId, data.fromOutletId, 'From Outlet / HO');

    const { rows, totals } = computeItems(data.items);

    const {
      items, status, supplierId, fromOutletId, ...rest
    } = data;

    const row = await tx.stockReceipt.create({
      data: {
        ...rest,
        tenantId,
        code,
        supplierId,
        supplierName,
        fromOutletId,
        fromOutletName,
        totalItems: totals.totalItems,
        totalReceivedQty: totals.totalReceivedQty,
        totalDiscount: totals.totalDiscount,
        totalTax: totals.totalTax,
        totalEstimatedValue: totals.totalEstimatedValue,
        status,
        createdBy: actor?.name || 'Admin',
        ...receivedFields(status, actor, null),
        items: { create: rows },
      },
      include: { items: true },
    });
    if (status === 'received') await receiveLotsForReceipt(tx, tenantId, row);
    return row;
  });
}

export async function updateStockReceipt(tenantId, id, data, actor) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.stockReceipt.findFirst({ where: { id, tenantId } });
    if (!existing) throw new ApiError(404, 'Stock receipt not found');

    const supplierName = await assertSupplierIsValid(tx, tenantId, data.supplierId);
    const fromOutletName = await assertOutletIsValid(tx, tenantId, data.fromOutletId, 'From Outlet / HO');

    const { rows, totals } = computeItems(data.items);
    const {
      items, status, code, supplierId, fromOutletId, ...rest
    } = data;

    // Items are a full replace on every edit (delete then recreate) — the
    // form always resubmits the complete grid, same approach the other
    // modules' edit flows use.
    await tx.stockReceiptItem.deleteMany({ where: { receiptId: id } });

    const row = await tx.stockReceipt.update({
      where: { id },
      data: {
        ...rest,
        supplierId,
        supplierName,
        fromOutletId,
        fromOutletName,
        totalItems: totals.totalItems,
        totalReceivedQty: totals.totalReceivedQty,
        totalDiscount: totals.totalDiscount,
        totalTax: totals.totalTax,
        totalEstimatedValue: totals.totalEstimatedValue,
        status,
        ...receivedFields(status, actor, existing),
        items: { create: rows },
      },
      include: { items: true },
    });
    // Stock-in happens once: only on the first transition to 'received'.
    if (status === 'received' && existing.status !== 'received') await receiveLotsForReceipt(tx, tenantId, row);
    return row;
  });
}

export async function deleteStockReceipt(tenantId, id) {
  const existing = await prisma.stockReceipt.findFirst({ where: { id, tenantId } });
  if (!existing) throw new ApiError(404, 'Stock receipt not found');
  await prisma.stockReceipt.delete({ where: { id } });
  return { id };
}

/**
 * Powers the Stock Receipt page's top 5-tile summary strip — every figure
 * here is a real aggregate across this tenant's actual StockReceipt rows,
 * computed at request time (never a stored/cached counter that could
 * drift). "Received (This Month)" and "Value Received (This Month)" are
 * scoped to receipts whose receivedOn falls within the current calendar
 * month (server clock) — a tenant with no receipts received this month
 * honestly shows 0 rather than a placeholder figure.
 */
export async function getStockReceiptSummary(tenantId) {
  const rows = await prisma.stockReceipt.findMany({
    where: { tenantId },
    select: {
      status: true, totalEstimatedValue: true, receivedOn: true,
    },
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const draftReceipts = rows.filter((row) => row.status === 'draft').length;
  const receivedReceipts = rows.filter((row) => row.status === 'received').length;
  const receivedThisMonth = rows.filter(
    (row) => row.status === 'received' && row.receivedOn && new Date(row.receivedOn) >= monthStart,
  );

  return {
    totalReceipts: rows.length,
    draftReceipts,
    receivedReceipts,
    receivedThisMonth: receivedThisMonth.length,
    valueReceived: round2(receivedThisMonth.reduce((sum, row) => sum + Number(row.totalEstimatedValue), 0)),
  };
}
