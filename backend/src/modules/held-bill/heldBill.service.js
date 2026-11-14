import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { loadTaxRateResolver } from '../sale/taxRates.js';

// Held ("parked") bills — see HeldBill in schema.prisma for the lifecycle.
// Nothing in this file ever creates a Sale, takes a payment, issues an
// invoice number or touches Product.availableQty: a held bill is just a
// saved cart. The sale itself is still created only by sale.service.js's
// createSale, which calls completeHeldBill() below inside its own
// transaction when the cart being paid came from a held bill.

// The only role today is ADMIN, and an outlet's admins share its parking
// shelf (park at one till, pick up at another). Any other role added later
// only ever sees its own bills. Flip to false to make held bills strictly
// private to the cashier who parked them.
const ADMIN_SEES_ALL_OUTLET_BILLS = true;

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

/**
 * Where-clause fragment every read/write goes through: same tenant, same
 * outlet as the caller's JWT (never client-supplied), and — unless the
 * caller is allowed to see the whole outlet — only their own bills.
 */
function accessScope(user) {
  const scope = { tenantId: user.tenantId, outletId: user.outletId ?? null };
  if (!(ADMIN_SEES_ALL_OUTLET_BILLS && user.role === 'ADMIN')) scope.userId = user.id;
  return scope;
}

// A bill the caller may open/edit/pay: parked (HELD), or already resumed by
// THIS user. Someone else's RESUMED bill is off limits.
function openableBy(user) {
  return { OR: [{ status: 'HELD' }, { status: 'RESUMED', resumedById: user.id }] };
}

const CONFLICT_MESSAGE = 'This held bill is no longer available — it was already resumed by another cashier, paid, or discarded.';

/**
 * Re-reads every product fresh (never trusts client prices) and computes
 * the same subtotal / discount / tax / grand-total maths createSale uses.
 * Stock is deliberately NOT checked here — holding reserves nothing; stock
 * is verified (and deducted) only when the sale is actually paid.
 */
async function priceLines(tx, tenantId, lines, discountType, discountValue) {
  const merged = new Map();
  lines.forEach((l) => merged.set(l.productId, (merged.get(l.productId) || 0) + l.qty));

  const products = await tx.product.findMany({ where: { id: { in: [...merged.keys()] }, tenantId } });
  const byId = new Map(products.map((p) => [p.id, p]));
  const taxRateOf = await loadTaxRateResolver(tx, tenantId);

  let subTotal = 0;
  const lineData = [...merged.entries()].map(([productId, qty]) => {
    const product = byId.get(productId);
    if (!product) throw new ApiError(400, 'One of the items in this bill no longer exists');
    if (product.status !== 'ACTIVE') throw new ApiError(400, `${product.name} is inactive and cannot be held`);
    const price = Number(product.salePrice);
    const amount = price * qty;
    subTotal += amount;
    return {
      productId, code: product.code, name: product.name, uom: product.uom, qty, price, taxRate: taxRateOf(product), amount,
    };
  });

  const discountAmount = discountType === 'percent' ? (subTotal * discountValue) / 100 : Math.min(discountValue, subTotal);
  const taxable = Math.max(subTotal - discountAmount, 0);
  const taxAmount = lineData.reduce((sum, l) => sum + (subTotal > 0 ? (l.amount / subTotal) * taxable : 0) * l.taxRate, 0);

  return {
    lineData,
    totals: {
      subTotal: round2(subTotal),
      discountAmount: round2(discountAmount),
      taxAmount: round2(taxAmount),
      grandTotal: round2(taxable + taxAmount),
      itemCount: lineData.length,
    },
  };
}

const num = (v) => Number(v);

function serializeSummary(b) {
  return {
    id: b.id,
    reference: b.reference,
    status: b.status,
    customerId: b.customerId,
    customerName: b.customerName,
    cashierName: b.cashierName,
    itemCount: b.itemCount,
    grandTotal: num(b.grandTotal),
    heldAt: b.heldAt,
    createdAt: b.createdAt,
    resumedAt: b.resumedAt,
  };
}

function serializeLine(line, live) {
  return {
    productId: line.productId,
    code: line.code,
    name: line.name,
    uom: line.uom,
    qty: line.qty,
    price: num(line.price),
    taxRate: num(line.taxRate),
    amount: num(line.amount),
    // Today's catalogue values, so the screen can flag a price/stock change
    // since the bill was parked. The sale is always re-priced on payment.
    live: live ? { price: num(live.salePrice), availableQty: live.availableQty, active: live.status === 'ACTIVE' } : null,
  };
}

async function loadDetail(tx, tenantId, id) {
  const bill = await tx.heldBill.findFirst({
    where: { id, tenantId },
    include: { lines: { orderBy: { id: 'asc' } }, customer: true },
  });
  const products = await tx.product.findMany({ where: { id: { in: bill.lines.map((l) => l.productId) }, tenantId } });
  const liveById = new Map(products.map((p) => [p.id, p]));
  return {
    ...serializeSummary(bill),
    discountType: bill.discountType,
    discountValue: num(bill.discountValue),
    discountAmount: num(bill.discountAmount),
    subTotal: num(bill.subTotal),
    taxAmount: num(bill.taxAmount),
    customer: bill.customer ? {
      id: bill.customer.id, code: bill.customer.code, name: bill.customer.name,
      phone: bill.customer.mobile, loyaltyPoints: bill.customer.loyaltyPoints || 0,
    } : null,
    lines: bill.lines.map((l) => serializeLine(l, liveById.get(l.productId))),
  };
}

async function assertCustomer(tx, tenantId, customerId) {
  if (!customerId) return;
  const customer = await tx.customer.findFirst({ where: { id: customerId, tenantId } });
  if (!customer) throw new ApiError(400, 'Selected customer was not found');
}

/** Held bills the caller can pick up: parked ones, plus their own unfinished resumed ones. */
export async function listHeldBills(user) {
  const bills = await prisma.heldBill.findMany({
    where: {
      ...accessScope(user),
      OR: [{ status: 'HELD' }, { status: 'RESUMED', resumedById: user.id }],
    },
    orderBy: { heldAt: 'desc' },
  });
  return bills.map(serializeSummary);
}

/** Parks the cart as a new held bill (idempotent per clientToken). */
export async function createHeldBill(user, input) {
  const {
    customerId, customerName, lines, discountType, discountValue, clientToken,
  } = input;

  if (clientToken) {
    const existing = await prisma.heldBill.findFirst({ where: { tenantId: user.tenantId, clientToken } });
    if (existing) {
      if (existing.userId !== user.id) throw new ApiError(409, CONFLICT_MESSAGE);
      return loadDetail(prisma, user.tenantId, existing.id);
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await assertCustomer(tx, user.tenantId, customerId);
      const { lineData, totals } = await priceLines(tx, user.tenantId, lines, discountType, discountValue);

      // Serialise reference allocation per tenant (rows are never deleted,
      // so count + 1 is monotonic) — two cashiers parking at the same
      // instant can't both claim HB-00007.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`heldbill:${user.tenantId}`}))`;
      const count = await tx.heldBill.count({ where: { tenantId: user.tenantId } });
      const reference = `HB-${String(count + 1).padStart(5, '0')}`;

      const bill = await tx.heldBill.create({
        data: {
          tenantId: user.tenantId,
          outletId: user.outletId || null,
          reference,
          userId: user.id,
          cashierName: user.name,
          customerId: customerId || null,
          customerName: customerName || 'Walk-in Customer',
          discountType,
          discountValue,
          ...totals,
          clientToken: clientToken || null,
          status: 'HELD',
          lines: { create: lineData },
        },
      });
      return loadDetail(tx, user.tenantId, bill.id);
    });
  } catch (err) {
    // Lost a race with a duplicate of the same request: hand back the winner.
    if (err?.code === 'P2002' && clientToken) {
      const existing = await prisma.heldBill.findFirst({ where: { tenantId: user.tenantId, clientToken, userId: user.id } });
      if (existing) return loadDetail(prisma, user.tenantId, existing.id);
    }
    throw err;
  }
}

/** Re-parks an existing (resumed/held) bill in place: header updated, lines replaced. */
export async function updateHeldBill(user, id, input) {
  const {
    customerId, customerName, lines, discountType, discountValue,
  } = input;

  return prisma.$transaction(async (tx) => {
    await assertCustomer(tx, user.tenantId, customerId);
    const { lineData, totals } = await priceLines(tx, user.tenantId, lines, discountType, discountValue);

    // One atomic guarded UPDATE: only succeeds while the bill is still open
    // to this user, so a stale screen can't resurrect a paid/discarded bill.
    const claimed = await tx.heldBill.updateMany({
      where: { id, ...accessScope(user), ...openableBy(user) },
      data: {
        status: 'HELD',
        resumedById: null,
        resumedAt: null,
        heldAt: new Date(),
        customerId: customerId || null,
        customerName: customerName || 'Walk-in Customer',
        discountType,
        discountValue,
        ...totals,
      },
    });
    if (claimed.count !== 1) await throwNotAvailable(tx, user, id);

    await tx.heldBillLine.deleteMany({ where: { heldBillId: id } });
    await tx.heldBillLine.createMany({ data: lineData.map((l) => ({ ...l, heldBillId: id })) });
    return loadDetail(tx, user.tenantId, id);
  });
}

/**
 * Picks a held bill back up. The status flip is a single guarded UPDATE, so
 * when two cashiers tap Resume on the same bill exactly one wins and the
 * other gets a 409. The same user re-resuming their own unfinished bill
 * (e.g. after a refresh) is allowed.
 */
export async function resumeHeldBill(user, id) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.heldBill.updateMany({
      where: { id, ...accessScope(user), ...openableBy(user) },
      data: { status: 'RESUMED', resumedById: user.id, resumedAt: new Date() },
    });
    if (claimed.count !== 1) await throwNotAvailable(tx, user, id);
    return loadDetail(tx, user.tenantId, id);
  });
}

/** Discards a held bill (kept as CANCELLED for audit, never deleted). */
export async function cancelHeldBill(user, id) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.heldBill.updateMany({
      where: { id, ...accessScope(user), ...openableBy(user) },
      data: { status: 'CANCELLED', resumedById: null },
    });
    if (claimed.count !== 1) await throwNotAvailable(tx, user, id);
    return { id, status: 'CANCELLED' };
  });
}

// 404 when the caller can't see the bill at all (other outlet/cashier —
// indistinguishable from "doesn't exist", so ids can't be probed), 409 when
// they can see it but it's no longer open.
async function throwNotAvailable(tx, user, id) {
  const visible = await tx.heldBill.findFirst({ where: { id, ...accessScope(user) }, select: { id: true } });
  if (!visible) throw new ApiError(404, 'Held bill not found');
  throw new ApiError(409, CONFLICT_MESSAGE);
}

/**
 * Called by createSale INSIDE its transaction when the cart being paid was
 * resumed from a held bill: stamps the held bill COMPLETED and links the new
 * TCZ bill (Linesales.DocEntry). The guard demands the bill is RESUMED by this very user, so it can
 * settle exactly once — a second payment attempt matches zero rows, throws,
 * and rolls the whole sale (and its stock deduction) back.
 */
export async function completeHeldBill(tx, { user, heldBillId, docEntry }) {
  const claimed = await tx.heldBill.updateMany({
    where: { id: heldBillId, ...accessScope(user), status: 'RESUMED', resumedById: user.id },
    data: { status: 'COMPLETED', completedAt: new Date(), tczDocEntry: docEntry },
  });
  if (claimed.count !== 1) {
    throw new ApiError(409, 'This held bill has already been paid, discarded, or is open on another screen — no payment was taken.');
  }
}
