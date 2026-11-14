import { ApiError } from '../../middleware/errorHandler.js';
import { billIdOf, lineIdOf } from './tczIds.js';

// Writes the Linesales (header) / LinesaleItemDetails (lines) records for one Line Sale
// bill — TCZ is the only sales store. It is only ever called from createSale
// (sale.service.js) with that function's own transaction client, so the bill, its
// lines, the held-bill close-out and the stock decrement commit or roll back as one
// unit.
//
// LinesaleOfferDetails (offer / discount details) is intentionally never written: the app
// does not apply promotions at checkout yet.

const OBJECT = 'Linesales';

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const round6 = (value) => Math.round((Number(value) || 0) * 1e6) / 1e6;

// Business time zone for TCZ bill times: Tamil Nadu, India (IST, UTC+05:30, no
// daylight saving). Linesales.CreateDate keeps the exact instant (timestamptz);
// Linesales.CreateTime is the wall-clock time of day in THIS zone (TIME, no zone),
// so a bill printed at 11:50 in Tamil Nadu reads 11:50 whatever time zone the
// server or the database session runs in. The business date of a bill is
// (CreateDate AT TIME ZONE 'Asia/Kolkata')::date.
export const TCZ_TIME_ZONE = 'Asia/Kolkata';
const istClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: TCZ_TIME_ZONE, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/**
 * The IST wall-clock time of day of `date`, as a Date on 1970-01-01 whose UTC
 * fields carry that wall-clock time. That is the shape Prisma needs for a
 * `@db.Time` column: it writes the Date's UTC time of day, so the stored TIME is
 * the IST time (e.g. 18:30:00.000Z -> 00:00:00.000, the start of the next IST day).
 * Milliseconds are preserved. Independent of the process time zone.
 */
export function istTimeOfDay(date) {
  const ms = date.getTime();
  if (!Number.isFinite(ms)) throw new TypeError('istTimeOfDay needs a valid Date');
  const part = Object.fromEntries(istClock.formatToParts(date).map((p) => [p.type, p.value]));
  const milli = ((ms % 1000) + 1000) % 1000;
  return new Date(Date.UTC(1970, 0, 1, Number(part.hour) % 24, Number(part.minute), Number(part.second), milli));
}

// Tenders that also fill the matching TCZ payment column (Cash/Card/UPI/Wallet).
// Every tender (including credit, store-credit, gift-card, cheque, bank-transfer)
// is recorded in PayMode; Paid/Balance/Received/ChangeAmount reflect the money.
const TENDER_COLUMN = { cash: 'cash', card: 'card', upi: 'upi', wallet: 'wallet' };

/**
 * Creates the bill header + lines and returns the API shape (see toSaleDto).
 * All money is stored at 2 decimals, the same precision the old Sale row had.
 * Still left NULL (meaning not defined anywhere): TotalRevenue, DiscountType,
 * SalesType, Return, Free, Batch, ChangeLog, SlpCode1/2, SlpName1/2, line TaxCode.
 */
export async function writeTczBill(tx, {
  tenantId, outletId, billNo, cashierName, customer, customerId, customerName,
  productById, lineData, subTotal, discountAmount, taxable, taxAmount, grandTotal,
  discountType, discountValue, paymentMethod, receivedAmount, changeAmount,
  cardType, cardLast4, cardBank, upiApp, upiTxnId, paymentReference,
  clientToken, stockBefore,
}) {
  const now = new Date();
  const grand = round2(grandTotal);
  const received = round2(receivedAmount);
  const paid = Math.min(received, grand);
  const balance = Math.max(round2(grand - received), 0);

  const tender = { cash: 0, card: 0, upi: 0, wallet: 0 };
  const column = TENDER_COLUMN[paymentMethod];
  if (column) tender[column] = paid;

  if (lineData.length === 0) throw new ApiError(500, 'A bill cannot be saved without lines');

  const header = await tx.tczOpos.create({
    data: {
      tenantId,
      outletId: outletId || null,
      customerId: customerId || null,
      clientToken: clientToken || null,
      docNum: billNo,
      createDate: now,
      // IST (Asia/Kolkata) wall-clock time of the SAME instant as createDate.
      createTime: istTimeOfDay(now),
      createdBy: cashierName,
      object: OBJECT,
      docStatus: 'COMPLETED',
      canceled: 'N',
      hold: 'N',
      customerMobileNumber: customer?.mobile || null,
      customerName,
      bpName: customer?.name || null,
      bpCode: customer?.code || null,
      headDiscTyp: discountType,
      headerDiscount: discountValue,
      discountAmount: round2(discountAmount),
      subTotal: round2(subTotal),
      taxableValue: round2(taxable),
      taxableValueTotal: round2(taxable),
      taxAmount: round2(taxAmount),
      grandTotal: grand,
      payMode: paymentMethod,
      received,
      changeAmount: round2(changeAmount),
      cash: tender.cash,
      card: tender.card,
      upi: tender.upi,
      wallet: tender.wallet,
      paid,
      balance,
      cardType: paymentMethod === 'card' ? (cardType || null) : null,
      cardLast4: paymentMethod === 'card' ? (cardLast4 || null) : null,
      cardBank: paymentMethod === 'card' ? (cardBank || null) : null,
      upiApp: paymentMethod === 'upi' ? (upiApp || null) : null,
      upiTxnId: paymentMethod === 'upi' ? (upiTxnId || null) : null,
      payRef: paymentReference || null,
      // Explicit NULL (not the column default of 0): meaning undefined.
      totalRevenue: null,
    },
  });

  const lines = lineData.map((line, index) => {
    const product = productById.get(line.productId);
    // Same apportioning createSale uses for the bill's tax amount.
    // Prices include GST: split the line's share of the payable into
    // taxable value + GST.
    const lineGross = subTotal > 0 ? (line.amount / subTotal) * (taxable + taxAmount) : 0;
    const lineTaxable = lineGross / (1 + Number(line.taxRate));
    const lineTax = lineGross - lineTaxable;
    return {
      docEntry: header.docEntry,
      lineId: index + 1,
      productId: line.productId,
      object: OBJECT,
      itemCode: line.code,
      itemName: line.name,
      barCode: line.code,
      uom: line.uom,
      price: round2(line.price),
      quantity: line.qty,
      // price x qty, before bill discount and tax
      lineTotal: round2(line.amount),
      inStock: stockBefore.get(line.productId) ?? product.availableQty,
      taxableValue: round6(lineTaxable),
      taxValue: round6(lineTax),
      taxRate: line.taxRate,
      // FIFO lot sold from + that lot's purchase price (null when unlotted).
      lotId: line.lotId || null,
      unitCost: line.unitCost == null ? null : round2(line.unitCost),
      // Tax rate as a percent (5 for 5%).
      tax: round6(Number(line.taxRate) * 100),
      taxCode: null,
    };
  });
  await tx.tczPos1.createMany({ data: lines });
  const saved = await tx.tczPos1.findMany({ where: { docEntry: header.docEntry }, orderBy: { lineId: 'asc' } });

  return toSaleDto(header, saved);
}

/**
 * Maps a TCZ header (+ its lines) to the sale JSON the API has always returned,
 * so the frontend contract (id / billNo / grandTotal / paymentMethod / lines[...])
 * is unchanged. `id` is String(DocEntry); a line's `id` is "<DocEntry>-<LineId>".
 */
export function toSaleDto(header, lines = []) {
  return {
    id: billIdOf(header.docEntry),
    docEntry: billIdOf(header.docEntry),
    tenantId: header.tenantId,
    outletId: header.outletId,
    billNo: header.docNum,
    customerId: header.customerId,
    customerName: header.customerName,
    cashierName: header.createdBy,
    subTotal: header.subTotal,
    discountType: header.headDiscTyp,
    discountValue: header.headerDiscount,
    discountAmount: header.discountAmount,
    taxAmount: header.taxAmount,
    grandTotal: header.grandTotal,
    paymentMethod: header.payMode,
    receivedAmount: header.received,
    changeAmount: header.changeAmount,
    cardType: header.cardType,
    cardLast4: header.cardLast4,
    cardBank: header.cardBank,
    upiApp: header.upiApp,
    upiTxnId: header.upiTxnId,
    paymentReference: header.payRef,
    status: header.docStatus,
    createdAt: header.createDate,
    updatedAt: header.updateDate || header.createDate,
    lines: lines.map(toLineDto),
  };
}

export function toLineDto(line) {
  return {
    id: lineIdOf(line.docEntry, line.lineId),
    saleId: billIdOf(line.docEntry),
    lineId: line.lineId,
    productId: line.productId,
    code: line.itemCode,
    name: line.itemName,
    uom: line.uom,
    qty: Number(line.quantity),
    price: line.price,
    taxRate: line.taxRate,
    amount: line.lineTotal,
  };
}
