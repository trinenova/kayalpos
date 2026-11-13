import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../middleware/errorHandler.js';

const MAX_PAGE_SIZE = 200;

const PRODUCT_SELECT = {
  id: true, code: true, name: true, group: true, brand: true, uom: true, hsnSac: true, taxCode: true,
};
const OUTLET_SELECT = { id: true, name: true };

function round2(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/**
 * The one place the actual selling price is calculated — used by both
 * create and update, so a PUT that only changes (say) the status can never
 * accidentally leave a stale sellingPriceExclTax/InclTax lying around from
 * a previous pricingMethod. Mirrors the frontend's live calculator exactly
 * (see sellingPriceSchema.js's computePricingPreview) so what the user sees
 * while typing matches what actually gets saved, but the server never
 * trusts the client's own arithmetic — every stored amount here is
 * recomputed from the raw inputs, same "never trust client math" rule
 * Expense.totalAmount follows.
 */
export function computePricing({
  pricingMethod, mrp, purchaseCost, marginPercent, fixedSellingPrice, taxRate,
}) {
  const mrpNum = round2(mrp);
  const purchaseCostNum = round2(purchaseCost);
  const marginPercentNum = Number(marginPercent) || 0;
  const taxRateNum = Number(taxRate) || 0;

  let sellingPriceExclTax;
  let marginAmount;

  if (pricingMethod === 'FIXED') {
    sellingPriceExclTax = round2(fixedSellingPrice);
    marginAmount = round2(mrpNum - sellingPriceExclTax);
  } else if (pricingMethod === 'MARGIN_FROM_COST') {
    marginAmount = round2((purchaseCostNum * marginPercentNum) / 100);
    sellingPriceExclTax = round2(purchaseCostNum + marginAmount);
  } else {
    // MARGIN_FROM_MRP (also the default/fallback for any unrecognized value —
    // zod's enum check already rejects those before this runs, so this only
    // ever sees a real PricingMethod).
    marginAmount = round2((mrpNum * marginPercentNum) / 100);
    sellingPriceExclTax = round2(mrpNum - marginAmount);
  }

  const sellingPriceInclTax = round2(sellingPriceExclTax * (1 + taxRateNum / 100));

  return {
    mrp: mrpNum,
    purchaseCost: purchaseCostNum,
    marginPercent: pricingMethod === 'FIXED' ? 0 : marginPercentNum,
    marginAmount,
    sellingPriceExclTax,
    sellingPriceInclTax,
  };
}

/** Turns known Prisma error codes into friendly 4xx responses instead of a raw 500. */
function prismaKnownError(err) {
  if (err?.code === 'P2002') {
    return new ApiError(409, 'A selling price already exists for this item, price list and outlet — edit that record instead', err.meta);
  }
  if (err?.code === 'P2003') {
    return new ApiError(409, 'The selected item or outlet no longer exists', err.meta);
  }
  return err;
}

async function requireProduct(tenantId, productId) {
  const product = await prisma.product.findFirst({ where: { id: productId, tenantId } });
  if (!product) throw new ApiError(404, 'Item not found');
  return product;
}

async function requireOutletIfSet(tenantId, outletId) {
  if (!outletId) return null;
  const outlet = await prisma.outlet.findFirst({ where: { id: outletId, tenantId } });
  if (!outlet) throw new ApiError(404, 'Outlet / Branch not found');
  return outlet;
}

/**
 * Powers the Selling Price List table at the bottom of the Masters >
 * Selling Price page. `search` matches the item's code/name or the price
 * list name (a plain scalar `contains` on SellingPrice.priceList wouldn't
 * be useful on its own for "find an item", so it's OR'd with a nested
 * relation filter on the joined Product).
 */
export async function listSellingPrices(tenantId, query = {}) {
  const {
    search, status, productId, outletId, priceList, page = 1, pageSize = 50,
  } = query;

  const where = { tenantId };
  if (status && status !== 'All') where.status = status;
  if (productId) where.productId = productId;
  if (outletId) where.outletId = outletId;
  if (priceList) where.priceList = priceList;
  if (search) {
    where.OR = [
      { priceList: { contains: search, mode: 'insensitive' } },
      { product: { code: { contains: search, mode: 'insensitive' } } },
      { product: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(pageSize, 10) || 50));

  const [rows, total] = await Promise.all([
    prisma.sellingPrice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * size,
      take: size,
      include: { product: { select: PRODUCT_SELECT }, outlet: { select: OUTLET_SELECT } },
    }),
    prisma.sellingPrice.count({ where }),
  ]);

  return {
    rows,
    meta: { page: pageNum, pageSize: size, total, totalPages: Math.max(1, Math.ceil(total / size)) },
  };
}

export async function getSellingPriceById(tenantId, id) {
  const row = await prisma.sellingPrice.findFirst({
    where: { id, tenantId },
    include: { product: { select: PRODUCT_SELECT }, outlet: { select: OUTLET_SELECT } },
  });
  if (!row) throw new ApiError(404, 'Selling price not found');
  return row;
}

export async function createSellingPrice(tenantId, data) {
  await requireProduct(tenantId, data.productId);
  await requireOutletIfSet(tenantId, data.outletId);

  const computed = computePricing(data);

  return prisma.sellingPrice.create({
    data: {
      tenantId,
      productId: data.productId,
      priceList: data.priceList,
      outletId: data.outletId || null,
      mrp: computed.mrp,
      purchaseCost: computed.purchaseCost,
      taxCode: data.taxCode || null,
      taxRate: Number(data.taxRate) || 0,
      pricingMethod: data.pricingMethod,
      marginPercent: computed.marginPercent,
      sellingPriceExclTax: computed.sellingPriceExclTax,
      sellingPriceInclTax: computed.sellingPriceInclTax,
      rounding: data.rounding,
      priceUpdateReason: data.priceUpdateReason || null,
      effectiveFrom: data.effectiveFrom,
      effectiveTo: data.effectiveTo || null,
      approvalRequired: Boolean(data.approvalRequired),
      status: data.status,
    },
    include: { product: { select: PRODUCT_SELECT }, outlet: { select: OUTLET_SELECT } },
  }).catch((err) => { throw prismaKnownError(err); });
}

/**
 * A PUT may only send a handful of changed fields (e.g. just `status`), so
 * every value computePricing() needs is first merged over the existing row
 * — never computed from req.body alone — otherwise e.g. flipping just the
 * Status radio would wipe out the stored selling price by recomputing it
 * from a body that has no mrp/marginPercent at all.
 */
export async function updateSellingPrice(tenantId, id, data) {
  const existing = await prisma.sellingPrice.findFirst({ where: { id, tenantId } });
  if (!existing) throw new ApiError(404, 'Selling price not found');

  if (data.productId && data.productId !== existing.productId) {
    await requireProduct(tenantId, data.productId);
  }
  if (data.outletId !== undefined && data.outletId !== existing.outletId) {
    await requireOutletIfSet(tenantId, data.outletId);
  }

  const merged = {
    pricingMethod: data.pricingMethod ?? existing.pricingMethod,
    mrp: data.mrp ?? existing.mrp,
    purchaseCost: data.purchaseCost ?? existing.purchaseCost,
    marginPercent: data.marginPercent ?? existing.marginPercent,
    fixedSellingPrice: data.fixedSellingPrice ?? existing.sellingPriceExclTax,
    taxRate: data.taxRate ?? existing.taxRate,
  };
  const computed = computePricing(merged);

  return prisma.sellingPrice.update({
    where: { id },
    data: {
      productId: data.productId ?? undefined,
      priceList: data.priceList ?? undefined,
      outletId: data.outletId !== undefined ? (data.outletId || null) : undefined,
      mrp: computed.mrp,
      purchaseCost: computed.purchaseCost,
      taxCode: data.taxCode !== undefined ? (data.taxCode || null) : undefined,
      taxRate: merged.taxRate,
      pricingMethod: merged.pricingMethod,
      marginPercent: computed.marginPercent,
      sellingPriceExclTax: computed.sellingPriceExclTax,
      sellingPriceInclTax: computed.sellingPriceInclTax,
      rounding: data.rounding ?? undefined,
      priceUpdateReason: data.priceUpdateReason !== undefined ? (data.priceUpdateReason || null) : undefined,
      effectiveFrom: data.effectiveFrom ?? undefined,
      effectiveTo: data.effectiveTo !== undefined ? (data.effectiveTo || null) : undefined,
      approvalRequired: data.approvalRequired ?? undefined,
      status: data.status ?? undefined,
    },
    include: { product: { select: PRODUCT_SELECT }, outlet: { select: OUTLET_SELECT } },
  }).catch((err) => { throw prismaKnownError(err); });
}

// The Price List screen's one "live" row per product — no outlet scoping,
// always in this fixed `priceList` bucket, kept distinct from any real
// named price lists the Selling Price master may also hold for the same
// product (see the Prisma model's @@unique([tenantId, productId, priceList,
// outletId]), which is exactly why this fixed priceList/outletId combo
// never collides with those).
const GRID_PRICE_LIST = 'Default';

/**
 * Powers the Price List screen's flat "every product, with its current
 * price" grid. Every ACTIVE product gets a row even if it has no Selling
 * Price record yet — `currentPrice` falls back to the product's own `mrp`
 * and `previousPrice`/the effective dates are null/the product's createdAt,
 * so the grid is never missing products just because nobody has used
 * "Update Price" on them yet.
 */
export async function listPriceGrid(tenantId, query = {}) {
  const { search, page = 1, pageSize = 100 } = query;

  const where = { tenantId, status: 'ACTIVE' };
  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
      { group: { contains: search, mode: 'insensitive' } },
      { packSize: { contains: search, mode: 'insensitive' } },
    ];
  }

  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const size = Math.min(500, Math.max(1, Number.parseInt(pageSize, 10) || 100));

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { code: 'desc' },
      skip: (pageNum - 1) * size,
      take: size,
      select: {
        id: true, code: true, name: true, group: true, uom: true, packSize: true, mrp: true, createdAt: true,
      },
    }),
    prisma.product.count({ where }),
  ]);

  const productIds = products.map((p) => p.id);
  const gridRows = productIds.length
    ? await prisma.sellingPrice.findMany({
      where: {
        tenantId, priceList: GRID_PRICE_LIST, outletId: null, productId: { in: productIds },
      },
    })
    : [];
  const gridRowByProductId = new Map(gridRows.map((row) => [row.productId, row]));

  const rows = products.map((product) => {
    const gridRow = gridRowByProductId.get(product.id);
    return {
      productId: product.id,
      code: product.code,
      name: product.name,
      category: product.group,
      uom: product.uom,
      packSize: product.packSize,
      previousPrice: gridRow ? gridRow.previousPrice : null,
      currentPrice: gridRow ? gridRow.mrp : product.mrp,
      effectiveFrom: gridRow ? gridRow.effectiveFrom : product.createdAt,
      effectiveTo: gridRow ? gridRow.effectiveTo : null,
      priceUpdateReason: gridRow ? gridRow.priceUpdateReason : null,
    };
  });

  return {
    rows,
    meta: { page: pageNum, pageSize: size, total, totalPages: Math.max(1, Math.ceil(total / size)) },
  };
}

/**
 * Applies every "Update Price" row from the Price List grid in one
 * transaction — each product's grid row is upserted (created the first
 * time its price is ever changed here, updated every time after), snapshots
 * the prior price into `previousPrice`, and resets `effectiveFrom` to now
 * ("Ongoing" until the next change, same as the reference design's
 * Effective To column staying blank).
 */
export async function bulkUpdatePriceGrid(tenantId, updates, changedBy) {
  const productIds = updates.map((u) => u.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds }, tenantId }, select: { id: true, mrp: true } });
  const productById = new Map(products.map((p) => [p.id, p]));

  const missing = productIds.filter((id) => !productById.has(id));
  if (missing.length) throw new ApiError(404, `${missing.length} item(s) in this update no longer exist`);

  const existingRows = await prisma.sellingPrice.findMany({
    where: {
      tenantId, priceList: GRID_PRICE_LIST, outletId: null, productId: { in: productIds },
    },
  });
  const existingByProductId = new Map(existingRows.map((row) => [row.productId, row]));

  const now = new Date();
  // Each update becomes two writes in the same transaction: the grid row
  // itself (upserted) and an append-only PriceHistory entry — the Actions
  // column's "Price History" dialog reads only the latter, since
  // SellingPrice.previousPrice can only ever remember one step back.
  const writes = updates.flatMap((update) => {
    const existing = existingByProductId.get(update.productId);
    const previousPrice = existing ? existing.mrp : productById.get(update.productId).mrp;
    const newPrice = round2(update.price);

    const gridWrite = existing
      ? prisma.sellingPrice.update({
        where: { id: existing.id },
        data: {
          mrp: newPrice,
          previousPrice,
          sellingPriceExclTax: newPrice,
          sellingPriceInclTax: newPrice,
          effectiveFrom: now,
          effectiveTo: null,
          priceUpdateReason: update.remarks || null,
        },
      })
      : prisma.sellingPrice.create({
        data: {
          tenantId,
          productId: update.productId,
          priceList: GRID_PRICE_LIST,
          outletId: null,
          mrp: newPrice,
          previousPrice,
          pricingMethod: 'FIXED',
          marginPercent: 0,
          sellingPriceExclTax: newPrice,
          sellingPriceInclTax: newPrice,
          effectiveFrom: now,
          priceUpdateReason: update.remarks || null,
          status: 'ACTIVE',
        },
      });

    const historyWrite = prisma.priceHistory.create({
      data: {
        tenantId,
        productId: update.productId,
        previousPrice,
        newPrice,
        remarks: update.remarks || null,
        changedBy: changedBy || null,
      },
    });

    return [gridWrite, historyWrite];
  });

  const results = await prisma.$transaction(writes);
  return { updated: results.length / 2 };
}

/**
 * Powers the Price List grid's Actions column — newest change first, so the
 * dialog reads top-to-bottom as "most recent first", matching the reference
 * design.
 */
export async function listPriceHistory(tenantId, productId) {
  await requireProduct(tenantId, productId);
  return prisma.priceHistory.findMany({
    where: { tenantId, productId },
    orderBy: { changedAt: 'desc' },
  });
}

export async function deleteSellingPrice(tenantId, id) {
  const existing = await prisma.sellingPrice.findFirst({ where: { id, tenantId } });
  if (!existing) throw new ApiError(404, 'Selling price not found');

  await prisma.sellingPrice.delete({ where: { id } });
  return { id };
}
