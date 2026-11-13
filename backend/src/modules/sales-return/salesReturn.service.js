import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { billIdOf, lineIdOf, parseBillId, parseLineId } from '../sale/tczIds.js';
import { restoreToLot } from '../product-lot/productLot.service.js';

function round2(n) {
  return Math.round(n * 100) / 100;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * "SR-DDMMYY-00007"-style, sequenced per calendar day (matching the
 * reference design's numbering) — counts today's returns for this tenant
 * and takes the next slot. Run inside the same transaction as the actual
 * create so two concurrent returns on the same day can't claim the same
 * number (the @@unique([tenantId, returnNo]) constraint is the last-resort
 * backstop either way, same pattern as createSale's nextBillNoWithinTx).
 */
async function nextReturnNoWithin(client, tenantId, date = new Date()) {
  const since = startOfToday();
  const count = await client.salesReturn.count({ where: { tenantId, createdAt: { gte: since } } });
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `SR-${dd}${mm}${yy}-${String(count + 1).padStart(5, '0')}`;
}

export async function nextReturnNoPreview(tenantId) {
  return nextReturnNoWithin(prisma, tenantId);
}

/**
 * Sums qty already returned per original bill line (LinesaleItemDetails DocEntry+LineId),
 * scoped to this tenant through the owning SalesReturn (SalesReturnItem itself
 * carries no tenantId) — powers both the lookup's "returnable qty" figures and
 * createSalesReturn's over-return guard, so the two can never disagree.
 * Keys are the API line ids ("<DocEntry>-<LineId>").
 */
async function getReturnedQtyByLine(client, tenantId, docEntry) {
  const rows = await client.salesReturnItem.findMany({
    where: { docEntry, return: { tenantId } },
    select: { docEntry: true, lineId: true, qty: true },
  });
  const map = {};
  rows.forEach((row) => {
    const key = lineIdOf(row.docEntry, row.lineId);
    map[key] = (map[key] || 0) + row.qty;
  });
  return map;
}

/**
 * Powers "Find Original Invoice": looks the Sale up by its real billNo,
 * and for every line on it, computes what's still eligible to come back —
 * `saleQty - everything already returned against that exact line across
 * every prior SalesReturn`. A line fully returned already simply reports
 * returnableQty: 0, so the UI can't add it again. `alreadyRefunded` is the
 * real sum of every past return's grandTotal against this sale — never a
 * hardcoded 0.
 */
export async function lookupOriginalInvoice(tenantId, billNo) {
  const sale = await prisma.tczOpos.findFirst({
    where: { tenantId, docNum: billNo },
    include: { lines: { orderBy: { lineId: 'asc' } } },
  });
  if (!sale) throw new ApiError(404, 'No invoice found with that bill number');

  const [returnedByLine, refundedAgg] = await Promise.all([
    getReturnedQtyByLine(prisma, tenantId, sale.docEntry),
    prisma.salesReturn.aggregate({ where: { tenantId, docEntry: sale.docEntry }, _sum: { grandTotal: true } }),
  ]);

  const productIds = [...new Set(sale.lines.map((line) => line.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, mrp: true } });
  const mrpByProductId = Object.fromEntries(products.map((p) => [p.id, Number(p.mrp)]));

  const items = sale.lines.map((line) => {
    const lineKey = lineIdOf(line.docEntry, line.lineId);
    const alreadyReturned = returnedByLine[lineKey] || 0;
    const qty = Number(line.quantity);
    return {
      saleLineId: lineKey,
      productId: line.productId,
      code: line.itemCode,
      name: line.itemName,
      uom: line.uom,
      rate: Number(line.price),
      taxRate: Number(line.taxRate),
      mrp: mrpByProductId[line.productId] || Number(line.price),
      saleQty: qty,
      returnableQty: Math.max(qty - alreadyReturned, 0),
    };
  });

  return {
    saleId: billIdOf(sale.docEntry),
    invoiceNo: sale.docNum,
    invoiceDate: sale.createDate,
    totalAmount: Number(sale.grandTotal),
    paidAmount: Number(sale.received),
    paymentMethod: sale.payMode,
    customerId: sale.customerId,
    customerName: sale.customerName,
    alreadyRefunded: round2(Number(refundedAgg._sum.grandTotal || 0)),
    items,
  };
}

export async function createSalesReturn(tenantId, data, actor) {
  return prisma.$transaction(async (tx) => {
    const docEntry = parseBillId(data.saleId);
    const sale = docEntry === null ? null
      : await tx.tczOpos.findFirst({ where: { docEntry, tenantId }, include: { lines: true } });
    if (!sale) throw new ApiError(400, 'Original invoice was not found');

    const lineById = new Map(sale.lines.map((line) => [lineIdOf(line.docEntry, line.lineId), line]));
    const returnedByLine = await getReturnedQtyByLine(tx, tenantId, sale.docEntry);

    const lineData = data.items.map((item) => {
      const line = lineById.get(item.saleLineId);
      if (!line) throw new ApiError(400, 'One of the selected items is not part of this invoice');

      const alreadyReturned = returnedByLine[item.saleLineId] || 0;
      const returnable = Number(line.quantity) - alreadyReturned;
      if (item.qty > returnable) {
        throw new ApiError(400, `${line.itemName}: only ${returnable} ${line.uom || ''} left to return`.replace(/ +/g, ' '));
      }

      const rate = Number(line.price);
      const taxRate = Number(line.taxRate);
      const amount = round2(item.qty * rate);
      return {
        docEntry: line.docEntry,
        lineId: line.lineId,
        productId: line.productId,
        code: line.itemCode,
        name: line.itemName,
        uom: line.uom || '',
        qty: item.qty,
        rate,
        taxRate,
        amount,
      };
    });

    const subTotal = round2(lineData.reduce((sum, line) => sum + line.amount, 0));
    const taxAmount = round2(lineData.reduce((sum, line) => sum + line.amount * line.taxRate, 0));
    const discountAmount = 0;
    const grandTotal = round2(subTotal - discountAmount + taxAmount);

    const returnNo = await nextReturnNoWithin(tx, tenantId);

    const row = await tx.salesReturn.create({
      data: {
        tenantId,
        returnNo,
        docEntry: sale.docEntry,
        customerId: sale.customerId,
        customerName: sale.customerName,
        cashierName: actor?.name || 'Admin',
        reason: data.reason,
        note: data.note || null,
        refundMode: data.refundMode,
        refundTo: data.refundMode === 'refund' ? data.refundTo : null,
        subTotal,
        discountAmount,
        taxAmount,
        grandTotal,
        items: { create: lineData },
      },
      include: { items: true },
    });

    // Reverses createSale's decrement — the returned goods physically come
    // back to stock (see the SalesReturn model's own comment in
    // schema.prisma for the same caveat availableQty already carries).
    await Promise.all(lineData.map((line) => tx.product.update({
      where: { id: line.productId },
      data: { availableQty: { increment: line.qty } },
    })));
    // FIFO: the returned units go back into the lot they were sold from.
    const soldLine = new Map(sale.lines.map((l) => [`${l.docEntry}-${l.lineId}`, l]));
    for (const line of lineData) {
      // eslint-disable-next-line no-await-in-loop
      await restoreToLot(tx, tenantId, soldLine.get(`${line.docEntry}-${line.lineId}`)?.lotId, line.qty);
    }

    return toReturnDto(row);
  });
}

// API shape: the original bill / line are exposed as the same string ids the
// lookup hands out (bill = "<DocEntry>", line = "<DocEntry>-<LineId>"); the raw
// bigint DocEntry must not reach JSON.
function toReturnDto(row) {
  const { docEntry, items, ...rest } = row;
  return {
    ...rest,
    saleId: billIdOf(docEntry),
    items: items.map(({ docEntry: itemDocEntry, lineId, ...item }) => ({
      ...item,
      saleLineId: lineIdOf(itemDocEntry, lineId),
    })),
  };
}
