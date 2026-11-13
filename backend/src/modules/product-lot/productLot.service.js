import { prisma } from '../../config/prisma.js';

/**
 * FIFO purchase lots. Each lot has its own MRP / purchase price / selling price
 * and qtyRemaining. Sales consume the oldest lot first (receivedAt, createdAt).
 * Product.availableQty remains the product total (other modules read it) and
 * Product.salePrice / mrp always mirror the lot that will be sold NEXT, so the
 * price on screen is the price the next unit is billed at.
 *
 * Stock that exists on Product.availableQty but not in any lot (e.g. adjusted
 * by another module) is sold last at the product's own price, cost unknown.
 */
const num = (v) => Number(v || 0);
const round3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;

const FIFO_ORDER = [{ receivedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }];

/** Lots with stock left for a product, oldest first (read-only). */
export function listOpenLots(client, tenantId, productId) {
  return client.productLot.findMany({
    where: { tenantId, productId, qtyRemaining: { gt: 0 } },
    orderBy: FIFO_ORDER,
  });
}

/**
 * Pure FIFO split of `qty` over `lots` (oldest first). Anything the lots cannot
 * cover comes back as an unlotted allocation at the product's own price.
 * Returns [{ lot|null, qty, price, mrp, cost|null }].
 */
export function splitFifo(lots, qty, product) {
  const parts = [];
  let left = round3(qty);
  for (const lot of lots) {
    if (left <= 0) break;
    const take = Math.min(left, num(lot.qtyRemaining));
    if (take <= 0) continue;
    parts.push({
      lot,
      qty: round3(take),
      price: num(lot.sellingPrice),
      mrp: num(lot.mrp),
      cost: num(lot.purchasePrice),
    });
    left = round3(left - take);
  }
  if (left > 0) {
    parts.push({
      lot: null, qty: left, price: num(product.salePrice), mrp: num(product.mrp), cost: null,
    });
  }
  return parts;
}

/**
 * Inside a sale transaction: locks the product's open lots, allocates `wanted`
 * per product across every cart line in order, and returns one allocation list
 * per line. Lot quantities are decremented here.
 * `lines` = [{ productId, qty }]; `productById` = Map of fresh Product rows.
 */
export async function allocateFifoForSale(tx, tenantId, lines, productById) {
  const lotsByProduct = new Map();
  const productIds = [...new Set(lines.map((l) => l.productId))].sort();
  for (const productId of productIds) {
    // eslint-disable-next-line no-await-in-loop
    await tx.$queryRaw`SELECT "Id" FROM "ProductLot" WHERE "TenantId" = ${tenantId} AND "ProductId" = ${productId} AND "QtyRemaining" > 0 FOR UPDATE`;
    // eslint-disable-next-line no-await-in-loop
    const lots = await listOpenLots(tx, tenantId, productId);
    lotsByProduct.set(productId, lots.map((l) => ({ ...l, qtyRemaining: num(l.qtyRemaining) })));
  }

  const used = new Map(); // lotId -> qty taken
  const result = lines.map((line) => {
    const lots = lotsByProduct.get(line.productId) || [];
    const parts = splitFifo(lots, line.qty, productById.get(line.productId));
    parts.forEach((part) => {
      if (!part.lot) return;
      part.lot.qtyRemaining = round3(part.lot.qtyRemaining - part.qty); // visible to the next cart line
      used.set(part.lot.id, round3((used.get(part.lot.id) || 0) + part.qty));
    });
    return parts;
  });

  for (const [lotId, qty] of used) {
    // eslint-disable-next-line no-await-in-loop
    await tx.productLot.update({ where: { id: lotId }, data: { qtyRemaining: { decrement: qty } } });
  }
  return result;
}

/** Points Product.salePrice / mrp at the oldest lot that still has stock. */
export async function syncProductToHeadLot(tx, tenantId, productId) {
  const [head] = await tx.productLot.findMany({
    where: { tenantId, productId, qtyRemaining: { gt: 0 } },
    orderBy: FIFO_ORDER,
    take: 1,
  });
  if (!head) return null;
  await tx.product.update({
    where: { id: productId },
    data: { salePrice: head.sellingPrice, mrp: head.mrp },
  });
  return head;
}

/** Creates a lot (stock-in) and adds its quantity to Product.availableQty. */
export async function receiveLot(tx, {
  tenantId, productId, lotNo, source = 'RECEIPT', sourceRef = null, receivedAt = new Date(),
  mrp, purchasePrice, sellingPrice, qty, expiryDate = null,
}) {
  const lot = await tx.productLot.create({
    data: {
      tenantId,
      productId,
      lotNo,
      source,
      sourceRef,
      receivedAt,
      mrp,
      purchasePrice,
      sellingPrice,
      qtyReceived: qty,
      qtyRemaining: qty,
      expiryDate,
    },
  });
  await tx.product.update({ where: { id: productId }, data: { availableQty: { increment: Math.round(qty) } } });
  await syncProductToHeadLot(tx, tenantId, productId);
  return lot;
}

/** Puts returned quantity back into the lot it was sold from. */
export async function restoreToLot(tx, tenantId, lotId, qty) {
  if (!lotId) return;
  const lot = await tx.productLot.findFirst({ where: { id: lotId, tenantId } });
  if (!lot) return;
  await tx.productLot.update({ where: { id: lotId }, data: { qtyRemaining: { increment: qty } } });
  await syncProductToHeadLot(tx, tenantId, lot.productId);
}

/** API: open lots (FIFO order) for the Line Sale screen, keyed by product. */
export async function listOpenLotsForProducts(tenantId, productIds) {
  const where = { tenantId, qtyRemaining: { gt: 0 } };
  if (productIds?.length) where.productId = { in: productIds };
  const lots = await prisma.productLot.findMany({ where, orderBy: FIFO_ORDER, take: 5000 });
  return lots.map((l) => ({
    id: l.id,
    productId: l.productId,
    lotNo: l.lotNo,
    source: l.source,
    receivedAt: l.receivedAt,
    mrp: num(l.mrp),
    purchasePrice: num(l.purchasePrice),
    sellingPrice: num(l.sellingPrice),
    qtyRemaining: num(l.qtyRemaining),
    expiryDate: l.expiryDate,
  }));
}
