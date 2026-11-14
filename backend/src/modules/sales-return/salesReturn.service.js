import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { billIdOf, lineIdOf, parseBillId, parseLineId } from '../sale/tczIds.js';
import { restoreToLot } from '../product-lot/productLot.service.js';

function round2(n) {
  return Math.round(n * 100) / 100;
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
    const taxAmount = round2(lineData.reduce((sum, line) => sum + line.amount * (1 - discountRatio) * line.taxRate, 0));
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
