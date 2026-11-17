import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { billIdOf, lineIdOf, parseBillId, parseLineId } from '../sale/tczIds.js';
import { restoreToLot, allocateFifoForSale, syncProductToHeadLot } from '../product-lot/productLot.service.js';
import { loadTaxRateResolver } from '../sale/taxRates.js';

function round2(n) {
  return Math.round(n * 100) / 100;
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

// Share of each line's value that was discounted on the original bill. The bill
// discount and GST were computed on the whole bill, so a return must refund the
// same proportion — otherwise a discounted sale would be over-refunded.
function discountRatioOf(sale) {
  const sub = Number(sale.subTotal || 0);
  const disc = Number(sale.discountAmount || 0);
  return sub > 0 ? Math.min(Math.max(disc / sub, 0), 1) : 0;
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
    discountRatio: discountRatioOf(sale),
    items,
  };
}

/**
 * Resolves and FIFO-allocates the new goods for an 'exchange' return's
 * `exchangeItems`, exactly the way createSale resolves a Line Sale cart:
 * every Product is re-read fresh inside this same transaction (never
 * trusted from the client), must be ACTIVE, and is priced from whichever
 * purchase lot FIFO says is next — unless the cashier typed an explicit
 * override price for that line, same convention as Line Sale's own
 * per-line price override. Returns the frozen line snapshots
 * (SalesReturnExchangeItem shape) plus the real product ids/qty wanted, so
 * the caller can decrement stock the same way createSale does.
 */
async function resolveExchangeLines(tx, tenantId, exchangeItems) {
  const productIds = [...new Set(exchangeItems.map((i) => i.productId))];
  const products = await tx.product.findMany({ where: { id: { in: productIds }, tenantId } });
  const productById = new Map(products.map((p) => [p.id, p]));

  const lines = exchangeItems.map((item) => {
    const product = productById.get(item.productId);
    if (!product) throw new ApiError(400, 'One of the exchange items no longer exists');
    if (product.status !== 'ACTIVE') throw new ApiError(400, `${product.name} is inactive and cannot be given in exchange`);
    const qty = round3(Number(item.qty));
    if (qty <= 0) throw new ApiError(400, `Quantity for ${product.name} must be greater than 0`);
    return { productId: product.id, qty, priceOverride: item.price != null ? Number(item.price) : null };
  });

  // Total qty wanted per product across every exchange line, BEFORE the FIFO
  // split below — the same quantity the stock decrement afterwards uses,
  // same "sum the request, not the post-split allocation" rule createSale
  // follows for its own wantedQty.
  const wantedQty = new Map();
  lines.forEach((line) => wantedQty.set(line.productId, round3((wantedQty.get(line.productId) || 0) + line.qty)));

  const allocations = await allocateFifoForSale(tx, tenantId, lines, productById);
  const taxRateOf = await loadTaxRateResolver(tx, tenantId);

  const lineData = [];
  lines.forEach((line, index) => {
    const product = productById.get(line.productId);
    allocations[index].forEach((part) => {
      const unitPrice = line.priceOverride != null ? line.priceOverride : part.price;
      const amount = round2(unitPrice * part.qty);
      lineData.push({
        productId: product.id,
        code: product.code,
        name: product.name,
        uom: product.uom || '',
        qty: part.qty,
        rate: unitPrice,
        taxRate: taxRateOf(product),
        amount,
        lotId: part.lot?.id || null,
        unitCost: part.cost,
      });
    });
  });

  return { lineData, wantedQty };
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
    const discountRatio = discountRatioOf(sale);
    const discountAmount = round2(subTotal * discountRatio);
    // Prices include GST: refund = subtotal - discount; GST is extracted.
    const taxAmount = round2(lineData.reduce((sum, line) => {
      const gross = line.amount * (1 - discountRatio);
      return sum + (gross - gross / (1 + line.taxRate));
    }, 0));
    const grandTotal = round2(subTotal - discountAmount);

    const returnType = data.returnType || 'return';

    // Only populated for an 'exchange' — a plain 'return' writes zeros for
    // all of these (see the SalesReturn model comment), which is the
    // honest value: there is no exchange side to total.
    let exchangeLineData = [];
    let exchangeWantedQty = new Map();
    let exchangeSubTotal = 0;
    let exchangeTaxAmount = 0;
    let exchangeGrandTotal = 0;
    let balanceAmount = 0;
    let settlementMode = null;

    if (returnType === 'exchange') {
      const resolved = await resolveExchangeLines(tx, tenantId, data.exchangeItems);
      exchangeLineData = resolved.lineData;
      exchangeWantedQty = resolved.wantedQty;

      exchangeSubTotal = round2(exchangeLineData.reduce((sum, line) => sum + line.amount, 0));
      exchangeTaxAmount = round2(exchangeLineData.reduce((sum, line) => {
        const gross = line.amount;
        return sum + (gross - gross / (1 + Number(line.taxRate)));
      }, 0));
      // The new goods carry no bill-level discount of their own (a fresh
      // exchange pick, not a re-discounted original sale), so grand total
      // is simply the sum of its GST-inclusive line amounts.
      exchangeGrandTotal = exchangeSubTotal;
      balanceAmount = round2(exchangeGrandTotal - grandTotal);

      if (balanceAmount !== 0) {
        if (!data.settlementMode) {
          throw new ApiError(400, balanceAmount > 0
            ? 'Select how the customer is paying the extra amount'
            : 'Select how the refund for the price difference is being given');
        }
        settlementMode = data.settlementMode;
      }
    }

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
        returnType,
        refundMode: returnType === 'return' ? data.refundMode : null,
        refundTo: returnType === 'return' && data.refundMode === 'refund' ? data.refundTo : null,
        settlementMode,
        subTotal,
        discountAmount,
        taxAmount,
        grandTotal,
        exchangeSubTotal,
        exchangeTaxAmount,
        exchangeGrandTotal,
        balanceAmount,
        items: { create: lineData },
        exchangeItems: { create: exchangeLineData },
      },
      include: { items: true, exchangeItems: true },
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

    // The new goods leave stock exactly like a Line Sale: an unconditional
    // decrement (no stock validation — same "a bill goes through even at 0
    // stock" rule createSale follows), products touched in a fixed order so
    // two concurrent transactions can't deadlock each other, then the
    // product's displayed price/MRP is pointed at whichever lot is next.
    const exchangeDecrements = [...exchangeWantedQty.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    for (const [productId, qty] of exchangeDecrements) {
      // eslint-disable-next-line no-await-in-loop
      await tx.product.updateMany({ where: { id: productId, tenantId }, data: { availableQty: { decrement: qty } } });
    }
    for (const productId of exchangeWantedQty.keys()) {
      // eslint-disable-next-line no-await-in-loop
      await syncProductToHeadLot(tx, tenantId, productId);
    }

    return toReturnDto(row);
  }, { maxWait: 10_000, timeout: 20_000 });
}

// API shape: the original bill / line are exposed as the same string ids the
// lookup hands out (bill = "<DocEntry>", line = "<DocEntry>-<LineId>"); the raw
// bigint DocEntry must not reach JSON. Exchange items have no original-bill
// line to translate (they're a fresh Product pick, not a SaleLine), so they
// pass through unchanged.
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

// ---------------------------------------------------------------------------
// Photo evidence. Metadata lives in the generic Attachment/AttachmentFile
// tables (SalesReturn.attachmentEntry -> Attachment.docEntry); the bytes are
// written under UPLOAD_DIR (default ./uploads), in a tenant/return-scoped
// folder. The extension comes from the validated MIME type, never from the
// client's file name, and every lookup is tenant-scoped.
// ---------------------------------------------------------------------------
const MAX_EVIDENCE_PER_RETURN = 5;
const MAX_EVIDENCE_BYTES = 1_000_000;
const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const uploadRoot = () => path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');

async function findReturnOr404(tenantId, id) {
  const row = await prisma.salesReturn.findFirst({ where: { id, tenantId }, select: { id: true, attachmentEntry: true } });
  if (!row) throw new ApiError(404, 'Sales return not found');
  return row;
}

const toEvidenceDto = (f) => ({
  lineId: f.lineId,
  fileName: f.fileName,
  contentType: f.contentType,
  fileSize: Number(f.fileSize || 0),
  uploadedDate: f.uploadedDate,
});

export async function listReturnEvidence(tenantId, returnId) {
  const ret = await findReturnOr404(tenantId, returnId);
  if (!ret.attachmentEntry) return [];
  const files = await prisma.attachmentFile.findMany({ where: { docEntry: ret.attachmentEntry }, orderBy: { lineId: 'asc' } });
  return files.map(toEvidenceDto);
}

export async function addReturnEvidence(tenantId, returnId, { fileName, dataUrl }, actor) {
  const ret = await findReturnOr404(tenantId, returnId);
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!match) throw new ApiError(400, 'Only JPEG, PNG or WebP images are allowed');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0 || buffer.length > MAX_EVIDENCE_BYTES) throw new ApiError(400, 'Photo must be under 1 MB');

  const meta = await prisma.$transaction(async (tx) => {
    let entry = ret.attachmentEntry;
    if (!entry) {
      const att = await tx.attachment.create({
        data: { tenantId, description: 'Sales return photo evidence', createdBy: actor?.name || null },
      });
      entry = att.docEntry;
      await tx.salesReturn.update({ where: { id: ret.id }, data: { attachmentEntry: entry } });
    }
    const existing = await tx.attachmentFile.findMany({ where: { docEntry: entry }, select: { lineId: true } });
    if (existing.length >= MAX_EVIDENCE_PER_RETURN) throw new ApiError(400, `At most ${MAX_EVIDENCE_PER_RETURN} photos per return`);
    const lineId = existing.reduce((m, f) => Math.max(m, f.lineId), 0) + 1;
    const relPath = path.join(tenantId, 'sales-return', `${ret.id}-${lineId}.${EXT_BY_MIME[match[1]]}`);
    return tx.attachmentFile.create({
      data: {
        docEntry: entry,
        lineId,
        fileName: fileName.slice(0, 200),
        filePath: relPath,
        contentType: match[1],
        fileSize: BigInt(buffer.length),
        uploadedBy: actor?.name || null,
      },
    });
  });

  const target = path.join(uploadRoot(), meta.filePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  return toEvidenceDto(meta);
}

export async function getReturnEvidenceFile(tenantId, returnId, lineId) {
  const ret = await findReturnOr404(tenantId, returnId);
  if (!ret.attachmentEntry) throw new ApiError(404, 'Photo not found');
  const file = await prisma.attachmentFile.findFirst({ where: { docEntry: ret.attachmentEntry, lineId } });
  if (!file?.filePath) throw new ApiError(404, 'Photo not found');
  const abs = path.resolve(uploadRoot(), file.filePath);
  if (!abs.startsWith(uploadRoot() + path.sep)) throw new ApiError(400, 'Invalid file path');
  return { absolutePath: abs, contentType: file.contentType, fileName: file.fileName };
}
