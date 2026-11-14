import { z } from 'zod';

// One returned line, referencing the original SaleLine (never a productId
// alone) — the service re-reads that SaleLine fresh inside the transaction
// to get the real rate/tax and to check the remaining returnable qty, the
// same "never trust the client's cached numbers" rule createSale follows.
const returnLineSchema = z.object({
  saleLineId: z.string().trim().min(1, 'saleLineId is required'),
  qty: z.coerce.number().int('Return qty must be a whole number').positive('Return qty must be at least 1'),
});

export const createSalesReturnSchema = z
  .object({
    saleId: z.string().trim().min(1, 'Select the original invoice first'),
    items: z.array(returnLineSchema).min(1, 'Add at least one item to return'),
    reason: z.enum(['damaged', 'wrong-item', 'expired', 'customer-changed-mind', 'other'], {
      errorMap: () => ({ message: 'Select a return reason' }),
    }),
    note: z.string().trim().max(250, 'Note cannot exceed 250 characters').optional().or(z.literal('')),
    refundMode: z.enum(['refund', 'credit-note'], {
      errorMap: () => ({ message: 'Select a refund mode' }),
    }),
    refundTo: z.enum(['cash', 'upi', 'card', 'store-credit']).optional().or(z.literal('')),
  })
  .superRefine((values, ctx) => {
    if (values.refundMode === 'refund' && !values.refundTo) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['refundTo'], message: 'Select where the refund is going' });
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
