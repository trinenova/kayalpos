import { z } from 'zod';

// One cart line as sent by the Line Sale screen. `productId` is what the
// server actually trusts — code/name/uom/taxRate are echoed back only (price is honoured only when the cashier overrides it)
// so a mismatch (stale client cache) can be surfaced clearly, never trusted
// for money math (see sale.service.js's createSale, which re-reads the
// Product row fresh inside the transaction).
export const saleLineSchema = z.object({
  productId: z.string().trim().min(1, 'Product is required'),
  qty: z.coerce.number().int('Quantity must be a whole number').positive('Quantity must be at least 1'),
  // Optional cashier price override (per unit, before GST). When present it is
  // used instead of the stock-lot / product price for this line.
  price: z.coerce.number().nonnegative('Price cannot be negative').optional(),
});

export const createSaleSchema = z.object({
  customerId: z.string().trim().min(1).optional().nullable(),
  customerName: z.string().trim().min(1).default('Walk-in Customer'),
  cashierName: z.string().trim().min(1, 'Cashier name is required'),
  lines: z.array(saleLineSchema).min(1, 'Add at least one item before payment'),
  discountType: z.enum(['amount', 'percent']).default('amount'),
  discountValue: z.coerce.number().nonnegative('Discount cannot be negative').default(0),
  // Extended beyond the original cash/upi/card/wallet/credit set to cover
  // the "Other Payments" bucket's own distinct tender types — store credit,
  // gift card, cheque, bank transfer — each reported separately by
  // paymentMode on that report rather than lumped under "wallet"/"credit".
  paymentMethod: z.enum(['cash', 'upi', 'card', 'wallet', 'credit', 'store-credit', 'gift-card', 'cheque', 'bank-transfer'], {
    errorMap: () => ({ message: 'Select a payment method' }),
  }),
  receivedAmount: z.coerce.number().nonnegative('Received amount cannot be negative').default(0),
  // Card-network detail — only ever meaningful when paymentMethod is
  // "card". The Line Sale checkout screen doesn't send these yet, so they
  // stay optional/nullable rather than required; a sale made without them
  // simply has no card detail on record (the Card Sales report shows "—").
  cardType: z.string().trim().min(1).optional().nullable(),
  cardLast4: z.string().trim().regex(/^\d{4}$/, 'Card last 4 digits must be exactly 4 digits').optional().nullable(),
  cardBank: z.string().trim().min(1).optional().nullable(),
  // UPI detail — only ever meaningful when paymentMethod is "upi". Same
  // "checkout doesn't send this yet" optionality as the card fields above.
  upiApp: z.string().trim().min(1).optional().nullable(),
  upiTxnId: z.string().trim().min(1).optional().nullable(),
  // Free-text reference for the miscellaneous "other" tenders (a cheque
  // number, gift card code, bank transfer UTR, loyalty-redemption note) —
  // not tied to one paymentMethod branch like card/UPI detail above, so it's
  // accepted regardless of tender. Same "checkout doesn't send this yet"
  // optionality; the Other Payments report shows "—" when unset.
  paymentReference: z.string().trim().min(1).max(120, 'Reference cannot exceed 120 characters').optional().nullable(),
  // Present only when this cart was resumed from a held bill (see
  // modules/held-bill). The held bill is marked COMPLETED in the same
  // transaction as the sale, which also prevents it ever being paid twice.
  heldBillId: z.string().trim().min(1).optional().nullable(),
  // Client-generated idempotency token for this checkout attempt. A retry of
  // a request that already committed (lost response, double click) returns the
  // bill that was saved instead of creating a duplicate — see createSale.
  clientToken: z.string().trim().min(8, 'clientToken is too short').max(100, 'clientToken is too long').optional().nullable(),
});

// Query params for the Cash Sales report (GET /sales/cash-summary). `date`
// scopes the Sales Summary/Payment Summary/transactions list to one calendar
// day (defaults to today in the service when omitted); the "Total Cash
// Sales"/"Total Items Sold" stat tiles are always all-time for the outlet,
// regardless of `date` — see getCashSalesReport for exactly which figures
// each scope feeds.
export const cashSalesQuerySchema = z.object({
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  page: z.coerce.number().int('Page must be a whole number').positive('Page must be at least 1').default(1),
  pageSize: z.coerce.number().int('Page size must be a whole number').positive('Page size must be at least 1')
    .max(100, 'Page size cannot exceed 100').default(10),
});

// Query params for the Card Sales report (GET /sales/card-summary) — same
// shape/semantics as cashSalesQuerySchema, just feeding getCardSalesReport.
export const cardSalesQuerySchema = cashSalesQuerySchema;

// Query params for the UPI Sales report (GET /sales/upi-summary) — same
// shape/semantics as cashSalesQuerySchema, just feeding getUpiSalesReport.
export const upiSalesQuerySchema = cashSalesQuerySchema;

// Query params for the Other Payments report (GET /sales/other-summary) —
// same shape/semantics as cashSalesQuerySchema, just feeding
// getOtherPaymentsReport.
export const otherPaymentsQuerySchema = cashSalesQuerySchema;
