import { z } from 'zod';

// Mirrors the Prisma `PricingMethod` enum (see schema.prisma's SellingPrice
// model doc comment for why this is a real enum, unlike the free-text lists
// most other master fields use).
export const PRICING_METHODS = ['FIXED', 'MARGIN_FROM_MRP', 'MARGIN_FROM_COST'];

// Query params for GET /masters/selling-price. Always paginated (page/
// pageSize both default) — unlike crudFactory's list route, this module's
// own listSellingPrices() joins in Product/Outlet, so an "unpaginated, but
// still bounded" mode isn't offered; the frontend's list screen always uses
// the paginated shape.
export const sellingPriceQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'All']).optional(),
  productId: z.string().trim().optional(),
  outletId: z.string().trim().optional(),
  priceList: z.string().trim().optional(),
  page: z.coerce.number().int('Page must be a whole number').positive('Page must be at least 1').default(1),
  pageSize: z.coerce.number().int('Page size must be a whole number').positive('Page size must be at least 1')
    .max(200, 'Page size cannot exceed 200').default(50),
});

// Base shape shared by create/update. Numeric fields are coerced from
// whatever the client sends (string or number) — same convention as
// Product/HsnSac's schemas. `mrp`/`purchaseCost`/`marginPercent`/
// `fixedSellingPrice`/`taxRate` are only ever used as INPUTS to
// sellingPrice.service.js's computePricing() — the actual stored
// sellingPriceExclTax/InclTax are always recomputed there, never taken
// from the client directly (see that file's doc comment).
const sellingPriceBaseSchema = z.object({
  productId: z.string().trim().min(1, 'Item is required'),
  priceList: z.string().trim().min(1, 'Price list is required'),
  // Nullable — omitted/empty means "applies to every outlet" (see the
  // Prisma model's own doc comment on outletId).
  outletId: z.string().trim().optional().nullable(),
  mrp: z.coerce.number({ invalid_type_error: 'Enter a valid MRP' }).nonnegative('MRP cannot be negative'),
  purchaseCost: z.coerce.number({ invalid_type_error: 'Enter a valid purchase cost' })
    .nonnegative('Purchase cost cannot be negative').default(0),
  taxCode: z.string().trim().optional().nullable(),
  taxRate: z.coerce.number({ invalid_type_error: 'Enter a valid tax rate' })
    .min(0, 'Tax rate must be 0 or more').max(100, 'Tax rate must be 100 or less').default(0),
  pricingMethod: z.enum(PRICING_METHODS, { errorMap: () => ({ message: 'Select a pricing method' }) })
    .default('MARGIN_FROM_MRP'),
  marginPercent: z.coerce.number({ invalid_type_error: 'Enter a valid margin %' })
    .min(0, 'Margin % cannot be negative').max(100, 'Margin % cannot exceed 100').default(0),
  // Only required/used when pricingMethod === 'FIXED' — see the
  // superRefine below and computePricing()'s branching.
  fixedSellingPrice: z.coerce.number({ invalid_type_error: 'Enter a valid selling price' })
    .nonnegative('Selling price cannot be negative').optional().nullable(),
  rounding: z.string().trim().min(1).default('Round to 2 Decimal'),
  priceUpdateReason: z.string().trim().max(250, 'Reason cannot exceed 250 characters').optional().or(z.literal('')).nullable(),
  effectiveFrom: z.coerce.date({ invalid_type_error: 'Enter a valid Effective From date' }),
  effectiveTo: z.coerce.date({ invalid_type_error: 'Enter a valid Effective To date' }).optional().nullable(),
  approvalRequired: z.coerce.boolean().default(false),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

// Query params for GET /masters/selling-price/grid — the Price List
// screen's flat "every product, with its current price" view.
export const priceGridQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int('Page must be a whole number').positive('Page must be at least 1').default(1),
  pageSize: z.coerce.number().int('Page size must be a whole number').positive('Page size must be at least 1')
    .max(500, 'Page size cannot exceed 500').default(100),
});

// Body for POST /masters/selling-price/grid/bulk-update — one row per
// product the user typed a new "Update Price" value for on the Price List
// screen's grid.
export const bulkUpdatePriceGridSchema = z.object({
  updates: z.array(z.object({
    productId: z.string().trim().min(1, 'Item is required'),
    price: z.coerce.number({ invalid_type_error: 'Enter a valid price' }).nonnegative('Price cannot be negative'),
    remarks: z.string().trim().max(250, 'Remarks cannot exceed 250 characters').optional().or(z.literal('')),
  })).min(1, 'No price changes to save'),
});

function withCrossFieldChecks(schema) {
  return schema.superRefine((data, ctx) => {
    if (data.pricingMethod === 'FIXED' && (data.fixedSellingPrice === undefined || data.fixedSellingPrice === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fixedSellingPrice'],
        message: 'Fixed selling price is required for the Fixed Selling Price method',
      });
    }
    if (data.effectiveTo && data.effectiveFrom && data.effectiveTo < data.effectiveFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['effectiveTo'],
        message: 'Effective To cannot be before Effective From',
      });
    }
  });
}

export const createSellingPriceSchema = withCrossFieldChecks(sellingPriceBaseSchema);

// .partial() first (every field optional on update), THEN the same
// cross-field checks — but only applied when both sides of a given check
// are actually present in this particular PUT body, since a partial update
// may only be touching a couple of fields (e.g. just `status`).
export const updateSellingPriceSchema = sellingPriceBaseSchema.partial().superRefine((data, ctx) => {
  if (data.pricingMethod === 'FIXED' && data.fixedSellingPrice === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fixedSellingPrice'],
      message: 'Fixed selling price is required for the Fixed Selling Price method',
    });
  }
  if (data.effectiveTo && data.effectiveFrom && data.effectiveTo < data.effectiveFrom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['effectiveTo'],
      message: 'Effective To cannot be before Effective From',
    });
  }
});
