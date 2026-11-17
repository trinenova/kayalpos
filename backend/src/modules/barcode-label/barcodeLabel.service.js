import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../middleware/errorHandler.js';

const CODE_PREFIX = 'LBL';
const CODE_LENGTH = 5;
const HISTORY_TAKE = 1000;

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function nextBatchCode(tenantId) {
  const count = await prisma.barcodeLabelBatch.count({ where: { tenantId } });
  return `${CODE_PREFIX}-${String(count + 1).padStart(CODE_LENGTH, '0')}`;
}

export async function nextCodePreview(tenantId) {
  return nextBatchCode(tenantId);
}

// Unlike the priced sales-cycle documents, there's nothing to tax or
// discount here — just how many items were selected and how many labels
// that adds up to (summing each selected row's Print Qty). Computed
// server-side from the real submitted items on every create/update, never
// trusted from whatever the client's form happened to display, same
// "frozen snapshot" rule the other modules apply to their money totals.
function computeTotals(items) {
  const totalItems = items.length;
  const totalLabels = round2(items.reduce((sum, item) => sum + Number(item.printQty), 0));
  return { totalItems, totalLabels };
}

function itemCreateData(item) {
  return {
    itemCode: item.itemCode,
    itemName: item.itemName,
    hsnCode: item.hsnCode || null,
    uom: item.uom || null,
    barcode: item.barcode || null,
    printQty: item.printQty,
    fromSerialBatch: item.fromSerialBatch || null,
    toSerialBatch: item.toSerialBatch || null,
  };
}

export async function listBarcodeLabelBatches(tenantId, { status, search } = {}) {
  const where = { tenantId };
  // A batch's status is a plain stored column (no live date-derived state
  // here, unlike Sales Quotation/Invoice's 'expired'/'overdue'), so it can be
  // filtered directly in the query.
  if (status && status !== 'all' && status !== 'All') {
    where.status = String(status).toLowerCase();
  }
  if (search) {
    const q = String(search);
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { labelName: { contains: q, mode: 'insensitive' } },
    ];
  }

  const rows = await prisma.barcodeLabelBatch.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { items: true },
    take: 1000,
  });
  return rows;
}

export async function getBarcodeLabelBatch(tenantId, id) {
  const row = await prisma.barcodeLabelBatch.findFirst({ where: { id, tenantId }, include: { items: true } });
  if (!row) throw new ApiError(404, 'Barcode & Label batch not found');
  return row;
}

export async function createBarcodeLabelBatch(tenantId, data, actor) {
  return prisma.$transaction(async (tx) => {
    const code = data.code || (await nextBatchCode(tenantId));
    const totals = computeTotals(data.items);

    const { items, status, ...rest } = data;

    const row = await tx.barcodeLabelBatch.create({
      data: {
        ...rest,
        tenantId,
        code,
        totalItems: totals.totalItems,
        totalLabels: totals.totalLabels,
        status,
        createdBy: actor?.name || 'Admin',
        items: { create: items.map(itemCreateData) },
      },
      include: { items: true },
    });
    return row;
  });
}

// `actor` isn't used yet (the header has no "last edited by" column), kept
// as a parameter so the route can pass req.user uniformly with create's
// signature and it's ready if that's added later.
export async function updateBarcodeLabelBatch(tenantId, id, data, actor) { // eslint-disable-line no-unused-vars
  return prisma.$transaction(async (tx) => {
    const existing = await tx.barcodeLabelBatch.findFirst({ where: { id, tenantId } });
    if (!existing) throw new ApiError(404, 'Barcode & Label batch not found');

    const totals = computeTotals(data.items);
    const { items, status, code, ...rest } = data;

    // Items are a full replace on every edit (delete then recreate) — the
    // form always resubmits the complete (selected-only) grid, so there's no
    // "which rows changed" diff to compute, same approach the sales-cycle
    // modules' edit flows use.
    await tx.barcodeLabelItem.deleteMany({ where: { batchId: id } });

    const row = await tx.barcodeLabelBatch.update({
      where: { id },
      data: {
        ...rest,
        totalItems: totals.totalItems,
        totalLabels: totals.totalLabels,
        status,
        items: { create: items.map(itemCreateData) },
      },
      include: { items: true },
    });
    return row;
  });
}

export async function deleteBarcodeLabelBatch(tenantId, id) {
  const existing = await prisma.barcodeLabelBatch.findFirst({ where: { id, tenantId } });
  if (!existing) throw new ApiError(404, 'Barcode & Label batch not found');
  await prisma.barcodeLabelBatch.delete({ where: { id } });
  return { id };
}

/**
 * Powers the Barcode & Label page's top 5-tile summary strip — every figure
 * here is a real aggregate across this tenant's actual BarcodeLabelBatch
 * rows, computed at request time (never a stored/cached counter that could
 * drift). "Total Labels Printed" only sums batches actually marked
 * 'printed' — see generateBarcodesForBatch below for the one action that
 * actually sets that status.
 */
export async function getBarcodeLabelSummary(tenantId) {
  const rows = await prisma.barcodeLabelBatch.findMany({
    where: { tenantId },
    select: { status: true, totalLabels: true },
  });

  const countByStatus = (status) => rows.filter((row) => row.status === status).length;
  const totalLabelsPrinted = rows
    .filter((row) => row.status === 'printed')
    .reduce((sum, row) => sum + Number(row.totalLabels), 0);

  return {
    totalBatches: rows.length,
    totalLabelsPrinted: round2(totalLabelsPrinted),
    printed: countByStatus('printed'),
    draft: countByStatus('draft'),
    pendingPrint: countByStatus('pending-print'),
  };
}

/**
 * Powers the Draft/Pending Print/Printed status pages' 4-tile strip (count +
 * three real aggregates) for one status at a time — count, total labels,
 * average labels per batch, and total line items across that status's
 * batches. All computed from real rows.
 */
export async function getBarcodeLabelStatusSummary(tenantId, status) {
  const rows = await prisma.barcodeLabelBatch.findMany({
    where: { tenantId, status },
    include: { items: true },
  });

  const count = rows.length;
  const totalLabels = rows.reduce((sum, row) => sum + Number(row.totalLabels), 0);
  const totalItems = rows.reduce((sum, row) => sum + row.items.length, 0);
  const averageLabels = count > 0 ? totalLabels / count : 0;

  return {
    count,
    totalLabels: round2(totalLabels),
    averageLabels: round2(averageLabels),
    totalItems,
  };
}

// A batch's items are free-text snapshots with no guaranteed Barcode value
// (see the BarcodeLabelItem model comment) — the Barcode column is only
// ever filled in when the user typed one in or picked a product that
// already had one set on the Product master. Generating has to produce a
// real, renderable value for every item regardless, so a blank Barcode
// falls back to the item's own Item Code, which is always present and
// always unique per tenant.
function resolveBarcodeValue(item) {
  const explicit = item.barcode && String(item.barcode).trim();
  return explicit || item.itemCode;
}

/**
 * The actual "generate barcode" action for a batch. For every item the
 * batch currently holds, it resolves a real barcode value (see
 * resolveBarcodeValue) and writes one permanent row to the append-only
 * BarcodeGenerationLog — then marks the batch 'printed' (with a real
 * `printedOn`), which is the only place in this module that status is ever
 * set. Wrapped in a transaction so the log and the status flip either both
 * happen or neither does.
 *
 * This never touches the batch's own items (no Barcode value is written
 * back onto BarcodeLabelItem) — the history log is the permanent record of
 * what was generated, while the batch's items stay exactly what the user
 * last saved. The actual scannable barcode/QR image is rendered client-side
 * from the `generated` values this returns (see frontend/src/modules/
 * barcode-label/components/BarcodeImage.jsx) — nothing on the backend
 * produces an image, only the resolved values and the permanent record that
 * they were generated.
 */
export async function generateBarcodesForBatch(tenantId, id, actor) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.barcodeLabelBatch.findFirst({ where: { id, tenantId }, include: { items: true } });
    if (!batch) throw new ApiError(404, 'Barcode & Label batch not found');
    if (batch.items.length === 0) throw new ApiError(400, 'This batch has no items to generate barcodes for');

    const generatedBy = actor?.name || 'Admin';
    const generated = batch.items.map((item) => ({
      itemCode: item.itemCode,
      itemName: item.itemName,
      barcodeValue: resolveBarcodeValue(item),
      barcodeType: batch.barcodeType,
      printQty: Number(item.printQty),
    }));

    await tx.barcodeGenerationLog.createMany({
      data: generated.map((g) => ({
        tenantId,
        batchId: batch.id,
        batchCode: batch.code,
        itemCode: g.itemCode,
        itemName: g.itemName,
        barcodeValue: g.barcodeValue,
        barcodeType: g.barcodeType,
        printQty: g.printQty,
        generatedBy,
      })),
    });

    const row = await tx.barcodeLabelBatch.update({
      where: { id },
      data: { status: 'printed', printedOn: new Date() },
      include: { items: true },
    });

    return { batch: row, generated };
  });
}

/**
 * Powers the "Barcode History" tab — every barcode value ever actually
 * generated for print, across every batch, newest first. A plain append-
 * only log (see the BarcodeGenerationLog model comment in schema.prisma),
 * so unlike listBarcodeLabelBatches this never changes retroactively when a
 * batch is later edited or deleted.
 */
export async function listBarcodeGenerationHistory(tenantId, { search, batchId } = {}) {
  const where = { tenantId };
  if (batchId) where.batchId = batchId;
  if (search) {
    const q = String(search);
    where.OR = [
      { itemCode: { contains: q, mode: 'insensitive' } },
      { itemName: { contains: q, mode: 'insensitive' } },
      { barcodeValue: { contains: q, mode: 'insensitive' } },
      { batchCode: { contains: q, mode: 'insensitive' } },
    ];
  }
  return prisma.barcodeGenerationLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: HISTORY_TAKE });
}
