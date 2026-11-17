import { z } from 'zod';

// One returned line, referencing the original SaleLine (never a productId
// alone) — the service re-reads that SaleLine fresh inside the transaction
// to get the real rate/tax and to check the remaining returnable qty, the
// same "never trust the client's cached numbers" rule createSale follows.
const returnLineSchema = z.object({
  saleLineId: z.string().trim().min(1, 'saleLineId is required'),
  qty: z.coerce.number().int('Return qty must be a whole number').positive('Return qty must be at least 1'),
});

// One new-goods line for an 'exchange' return — a plain Product pick (never
// an original SaleLine, there isn't one), re-read fresh server-side for its
// real price/tax/stock the same way createSale re-reads every cart line's
// Product. `price` is an optional cashier override, same convention as
// Line Sale's own per-line price override.
const exchangeLineSchema = z.object({
  productId: z.string().trim().min(1, 'Product is required'),
  qty: z.coerce.number().positive('Quantity must be greater than 0').max(999999, 'Quantity is too large')
    .refine((n) => Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6, 'Quantity can have at most 3 decimal places'),
  price: z.coerce.number().nonnegative('Price cannot be negative').optional(),
});

export const createSalesReturnSchema = z
  .object({
    saleId: z.string().trim().min(1, 'Select the original invoice first'),
    items: z.array(returnLineSchema).min(1, 'Add at least one item to return'),
    reason: z.enum(['damaged', 'wrong-item', 'expired', 'customer-changed-mind', 'other'], {
      errorMap: () => ({ message: 'Select a return reason' }),
    }),
    note: z.string().trim().max(250, 'Note cannot exceed 250 characters').optional().or(z.literal('')),
    // Chosen once at the top of the Sales Return screen (the Return/Exchange
    // select in the Scan/Search Item card) — defaults to 'return' so older
    // clients that don't send it yet keep working exactly as before.
    returnType: z.enum(['return', 'exchange']).default('return'),
    // Only required/meaningful when returnType is 'return' — see the
    // superRefine below. A plain return still settles by handing money
    // back; 'credit-note' keeps the "store credit instead of cash" choice
    // the old Refund/Adjustment card offered, without a separate radio.
    refundMode: z.enum(['refund', 'credit-note']).optional(),
    refundTo: z.enum(['cash', 'upi', 'card', 'store-credit']).optional().or(z.literal('')),
    // Only meaningful when returnType is 'exchange': the new goods the
    // customer is taking instead of a refund.
    exchangeItems: z.array(exchangeLineSchema).optional().default([]),
    // Only meaningful when returnType is 'exchange', and only once the
    // price difference is known to be non-zero — the service computes that
    // server-side (never trusting a client-sent balance) and rejects the
    // request if it's non-zero and this is missing, since the schema can't
    // know the balance in advance to require it itself.
    settlementMode: z.enum(['cash', 'upi', 'card', 'store-credit']).optional().or(z.literal('')),
  })
  .superRefine((values, ctx) => {
    if (values.returnType === 'return') {
      if (!values.refundMode) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['refundMode'], message: 'Select a refund mode' });
      } else if (values.refundMode === 'refund' && !values.refundTo) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['refundTo'], message: 'Select where the refund is going' });
      }
      if (values.exchangeItems.length > 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['exchangeItems'], message: 'Exchange items are only allowed for an exchange' });
      }
    } else if (values.exchangeItems.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['exchangeItems'], message: 'Add at least one item the customer is taking in exchange' });
    }
  });

// One evidence photo, sent as a data URL (the app has no multipart parser; the
// frontend downsizes photos first so a single one is well under the 2mb JSON
// body limit). The service re-validates the decoded bytes.
export const evidenceUploadSchema = z.object({
  fileName: z.string().trim().min(1, 'File name is required').max(200),
  dataUrl: z.string().regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'Only JPEG, PNG or WebP images are allowed')
    .max(1_500_000, 'Photo is too large'),
});
