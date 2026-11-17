import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../middleware/errorHandler.js';
import {
  listLineSaleBillsAsInvoices, getLineSaleBillAsInvoice, parsePosInvoiceId,
} from '../sale/sale.service.js';

const CODE_PREFIX = 'INV';
const CODE_LENGTH = 5;

// SGST + CGST split (2.5% + 2.5% = 5% total), matching the reference design's
// invoice detail cards / InvoiceTotalsCard, and the same rate Sale, Sales
// Quotation and Sales Order already use.
const HALF_TAX_RATE = 0.025;

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function nextInvoiceCode(tenantId) {
  const count = await prisma.salesInvoice.count({ where: { tenantId } });
  return `${CODE_PREFIX}-${String(count + 1).padStart(CODE_LENGTH, '0')}`;
}

export async function nextCodePreview(tenantId) {
  return nextInvoiceCode(tenantId);
}

/**
 * The DB only ever stores 'draft' | 'sent' | 'paid' (see the SalesInvoice
 * model comment in schema.prisma) — 'overdue' is derived live here, the
 * same rule Sales Quotation uses for its own 'expired' status: a 'sent'
 * invoice with a dueDate that has passed reads as 'overdue', but a draft
 * that was never sent can't be overdue and a paid invoice is already
 * resolved either way. An invoice with no dueDate at all can never be
 * overdue — there's nothing to have passed.
 */
export function computeStatus(row) {
  if (row.status === 'sent' && row.dueDate && new Date(row.dueDate) < new Date()) return 'overdue';
  return row.status;
}

// `dbStatus` is included alongside the live-computed `status` so the Edit
// Invoice form can tell a real 'draft'/'sent' apart from a 'sent' that's
// merely displaying as 'overdue' today — editing never needs to know about
// the derived value, only the real stored one.
function toApiShape(row) {
  return { ...row, status: computeStatus(row), dbStatus: row.status };
}

/**
 * Recomputes every money figure from the line items server-side — never
 * trusts whatever totals the client's form happened to display. Mirrors
 * InvoiceTotalsCard's own math exactly, and is identical to Sales
 * Quotation/Sales Order's own computeTotals() since all three forms share
 * the same items-grid shape and tax convention.
 */
function computeTotals(items, extraDiscount) {
  let subTotal = 0;
  let lineDiscountTotal = 0;

  const lineData = items.map((item) => {
    const lineTotal = item.qty * item.unitPrice;
    const discountAmount = round2(lineTotal * (item.discountPercent / 100));
    const amount = Math.max(round2(lineTotal - discountAmount), 0);
    subTotal += lineTotal;
    lineDiscountTotal += discountAmount;
    return { ...item, discountAmount, amount };
  });

  const discountAmount = round2(lineDiscountTotal + extraDiscount);
  const taxableAmount = Math.max(round2(subTotal - discountAmount), 0);
  const sgstAmount = round2(taxableAmount * HALF_TAX_RATE);
  const cgstAmount = round2(taxableAmount * HALF_TAX_RATE);
  const grandTotal = round2(taxableAmount + sgstAmount + cgstAmount);

  return {
    lineData,
    subTotal: round2(subTotal),
    discountAmount,
    taxableAmount,
    sgstAmount,
    cgstAmount,
    grandTotal,
  };
}

function itemCreateData(item) {
  return {
    itemCode: item.itemCode,
    itemName: item.itemName,
    hsnCode: item.hsnCode || null,
    qty: item.qty,
    unit: item.unit || null,
    unitPrice: item.unitPrice,
    discountPercent: item.discountPercent,
    discountAmount: item.discountAmount,
    taxCode: item.taxCode || null,
    amount: item.amount,
  };
}

/**
 * Real SalesInvoice rows PLUS every Line Sale (POS) bill, merged into one
 * list and sorted by date — see sale.service.js's
 * listLineSaleBillsAsInvoices for how a Linesales/TczOpos bill is shaped to
 * fit this same row contract. A Line Sale bill always reads as 'paid' (it
 * settles immediately at checkout), so it naturally falls into the Paid
 * tab/status filter below alongside any real invoice marked paid.
 */
export async function listSalesInvoices(tenantId, { status, search } = {}) {
  const where = { tenantId };
  if (search) {
    const q = String(search);
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { customerName: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [rows, posRows] = await Promise.all([
    prisma.salesInvoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: true },
      take: 1000,
    }),
    listLineSaleBillsAsInvoices(tenantId, { search }),
  ]);
  const shaped = [...rows.map(toApiShape), ...posRows]
    .sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));

  // Status filtering happens after the live computation above (not in the
  // Prisma `where`), since 'overdue' isn't a real column — see computeStatus().
  if (status && status !== 'all' && status !== 'All') {
    return shaped.filter((row) => row.status === String(status).toLowerCase());
  }
  return shaped;
}

export async function getSalesInvoice(tenantId, id) {
  const posDocEntry = parsePosInvoiceId(id);
  if (posDocEntry !== null) {
    const row = await getLineSaleBillAsInvoice(tenantId, posDocEntry);
    if (!row) throw new ApiError(404, 'Sales invoice not found');
    return row;
  }
  const row = await prisma.salesInvoice.findFirst({ where: { id, tenantId }, include: { items: true } });
  if (!row) throw new ApiError(404, 'Sales invoice not found');
  return toApiShape(row);
}

// If a Sales Order / Quotation Ref. is supplied, it must actually name a
// real document of this tenant's — never accept a stray string that looks
// like a code but isn't. Blank is fine (both fields are optional).
async function assertReferencesAreValid(tx, tenantId, { salesOrderRef, quotationRef }) {
  if (salesOrderRef) {
    const order = await tx.salesOrder.findFirst({ where: { tenantId, code: salesOrderRef } });
    if (!order) throw new ApiError(400, `Sales order reference "${salesOrderRef}" was not found`);
  }
  if (quotationRef) {
    const quotation = await tx.salesQuotation.findFirst({ where: { tenantId, code: quotationRef } });
    if (!quotation) throw new ApiError(400, `Quotation reference "${quotationRef}" was not found`);
  }
}

export async function createSalesInvoice(tenantId, data, actor) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({ where: { id: data.customerId, tenantId } });
    if (!customer) throw new ApiError(400, 'Selected customer was not found');
    await assertReferencesAreValid(tx, tenantId, data);

    const code = data.code || (await nextInvoiceCode(tenantId));
    const totals = computeTotals(data.items, data.extraDiscount);

    const {
      items, extraDiscount, customerId, status, ...rest
    } = data;

    const row = await tx.salesInvoice.create({
      data: {
        ...rest,
        tenantId,
        code,
        customerId,
        customerName: customer.name,
        extraDiscount,
        subTotal: totals.subTotal,
        discountAmount: totals.discountAmount,
        taxableAmount: totals.taxableAmount,
        sgstAmount: totals.sgstAmount,
        cgstAmount: totals.cgstAmount,
        grandTotal: totals.grandTotal,
        status,
        createdBy: actor?.name || 'Admin',
        items: { create: totals.lineData.map(itemCreateData) },
      },
      include: { items: true },
    });
    return toApiShape(row);
  });
}

// `actor` isn't used yet (the header has no "last edited by" column), kept
// as a parameter so the route can pass req.user uniformly with create's
// signature and it's ready if that's added later.
export async function updateSalesInvoice(tenantId, id, data, actor) { // eslint-disable-line no-unused-vars
  if (parsePosInvoiceId(id) !== null) throw new ApiError(400, 'A Line Sale bill cannot be edited as a Sales Invoice');
  return prisma.$transaction(async (tx) => {
    const existing = await tx.salesInvoice.findFirst({ where: { id, tenantId } });
    if (!existing) throw new ApiError(404, 'Sales invoice not found');

    const customer = await tx.customer.findFirst({ where: { id: data.customerId, tenantId } });
    if (!customer) throw new ApiError(400, 'Selected customer was not found');
    await assertReferencesAreValid(tx, tenantId, data);

    const totals = computeTotals(data.items, data.extraDiscount);
    const {
      items, extraDiscount, customerId, status, code, ...rest
    } = data;

    // Items are a full replace on every edit (delete then recreate) — the
    // form always resubmits the complete grid, so there's no "which rows
    // changed" diff to compute, same approach Sales Quotation/Sales Order's
    // edit uses.
    await tx.salesInvoiceItem.deleteMany({ where: { invoiceId: id } });

    const row = await tx.salesInvoice.update({
      where: { id },
      data: {
        ...rest,
        customerId,
        customerName: customer.name,
        extraDiscount,
        subTotal: totals.subTotal,
        discountAmount: totals.discountAmount,
        taxableAmount: totals.taxableAmount,
        sgstAmount: totals.sgstAmount,
        cgstAmount: totals.cgstAmount,
        grandTotal: totals.grandTotal,
        status,
        items: { create: totals.lineData.map(itemCreateData) },
      },
      include: { items: true },
    });
    return toApiShape(row);
  });
}

export async function deleteSalesInvoice(tenantId, id) {
  if (parsePosInvoiceId(id) !== null) throw new ApiError(400, 'A Line Sale bill cannot be deleted from Sales Invoice');
  const existing = await prisma.salesInvoice.findFirst({ where: { id, tenantId } });
  if (!existing) throw new ApiError(404, 'Sales invoice not found');
  await prisma.salesInvoice.delete({ where: { id } });
  return { id };
}

/**
 * Powers the Sales Invoice page's top 5-tile summary strip — every figure
 * here is a real aggregate across this tenant's actual SalesInvoice rows
 * PLUS its Line Sale bills (see listSalesInvoices), computed at request time
 * (never a stored/cached counter that could drift).
 */
export async function getSalesInvoiceSummary(tenantId) {
  const [rows, posRows] = await Promise.all([
    prisma.salesInvoice.findMany({
      where: { tenantId },
      select: { status: true, dueDate: true, grandTotal: true },
    }),
    listLineSaleBillsAsInvoices(tenantId),
  ]);
  const shaped = [
    ...rows.map((row) => ({ ...row, status: computeStatus(row) })),
    ...posRows.map((row) => ({ status: row.status, grandTotal: row.grandTotal })),
  ];

  const totalAmount = shaped.reduce((sum, row) => sum + Number(row.grandTotal), 0);
  const countByStatus = (status) => shaped.filter((row) => row.status === status).length;

  return {
    totalInvoices: shaped.length,
    totalAmount: round2(totalAmount),
    paid: countByStatus('paid'),
    draft: countByStatus('draft'),
    overdue: countByStatus('overdue'),
  };
}

/**
 * Powers the Draft/Sent/Paid/Overdue status pages' 4-tile strip (count +
 * three real aggregates) for one status at a time — count, total invoice
 * value, average invoice value, and total line items across that status's
 * invoices and (for 'paid') Line Sale bills. All computed from real rows; a
 * status with nothing in it honestly returns zeros rather than any
 * placeholder figure. No real SalesInvoice row sets status 'paid' yet (see
 * the SalesInvoice model comment) — so today the Paid tab's figures come
 * entirely from Line Sale bills, which is accurate, not a bug.
 */
export async function getSalesInvoiceStatusSummary(tenantId, status) {
  const [rows, posRows] = await Promise.all([
    prisma.salesInvoice.findMany({
      where: { tenantId },
      include: { items: true },
    }),
    listLineSaleBillsAsInvoices(tenantId),
  ]);
  const shaped = [
    ...rows.map((row) => ({ ...row, status: computeStatus(row) })),
    ...posRows,
  ].filter((row) => row.status === status);

  const count = shaped.length;
  const totalAmount = shaped.reduce((sum, row) => sum + Number(row.grandTotal), 0);
  const totalItems = shaped.reduce((sum, row) => sum + row.items.length, 0);
  const averageAmount = count > 0 ? totalAmount / count : 0;

  return {
    count,
    totalAmount: round2(totalAmount),
    averageAmount: round2(averageAmount),
    totalItems,
  };
}
