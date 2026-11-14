import { z } from 'zod';

// `code` is intentionally NOT required — the CRUD factory auto-generates it
// (PROD0001, PROD0002, ...) on create, matching the frontend's mock data
// convention (4-digit sequence).
const productShape = (d) => ({
  code: z.string().trim().min(1).optional(),
  // Optional short alias; unique per tenant (DB constraint). A blank value is
  // stored as NULL — never '' — so blanks never collide with each other.
  shortId: z.string().trim().max(20, 'Short ID can be at most 20 characters').optional().nullable()
    .transform((v) => (v ? v : null)),
  name: z.string().trim().min(1, 'Product name is required'),
  foreignName: z.string().trim().optional().nullable(),
  group: z.string().trim().min(1, 'Product group is required'),
  // Kept loose (non-empty-when-present, not a hard enum) same reasoning as
  // group/brand below — its option list lives in the frontend's
  // createProductSchema.js and can grow without a matching backend redeploy.
  productType: z.string().trim().optional().nullable(),
  productSubGroup: z.string().trim().optional().nullable(),
  brand: z.string().trim().optional().nullable(),
  packSize: z.string().trim().optional().nullable(),
  uom: z.string().trim().min(1, 'UOM is required'),
  uomGroup: z.string().trim().optional().nullable(),
  hsnSac: z.string().trim().optional().nullable(),
  taxCode: z.string().trim().optional().nullable(),
  taxGroup: z.string().trim().optional().nullable(),
  priceList: z.string().trim().optional().nullable(),
  preferredVendor: z.string().trim().optional().nullable(),
  purchasingUom: z.string().trim().optional().nullable(),
  salesUom: z.string().trim().optional().nullable(),
  unitPrice: d(z.coerce.number().nonnegative('Unit price cannot be negative'), 0),
  isSalesItem: d(z.coerce.boolean(), true),
  isPurchaseItem: d(z.coerce.boolean(), true),
  isInventoryItem: d(z.coerce.boolean(), true),
  barcode: z.string().trim().optional().nullable(),
  additionalIdentifier: z.string().trim().optional().nullable(),
  shippingType: z.string().trim().optional().nullable(),
  remarks: z.string().trim().optional().nullable(),
  manageItemBy: z.string().trim().optional().nullable(),
  manageMethod: z.string().trim().optional().nullable(),
  isExcisable: d(z.coerce.boolean(), false),
  isGst: d(z.coerce.boolean(), false),
  salePrice: d(z.coerce.number().nonnegative('Sale price cannot be negative'), 0),
  mrp: d(z.coerce.number().nonnegative('MRP cannot be negative'), 0),
  availableQty: d(z.coerce.number().int('Available qty must be a whole number').nonnegative('Available qty cannot be negative'), 0),
  status: d(z.enum(['ACTIVE', 'INACTIVE']), 'ACTIVE'),
});

// Create fills in defaults for anything omitted. Update must NOT: Zod 4 keeps
// applying `.default()` through `.partial()`, so every PUT that omitted
// salePrice/mrp (the Edit form never sends them) silently reset them to 0, and
// re-applied the other defaults too. Update therefore uses default-less fields.
const withDefault = (schema, value) => schema.default(value);
const noDefault = (schema) => schema.optional();

export const createProductSchema = z.object(productShape(withDefault));
export const updateProductSchema = z.object(productShape((schema) => noDefault(schema))).partial();

// One row of a bulk Excel/CSV import — same shape as create, but every
// numeric field arrives as whatever Excel/SheetJS produced (string or
// number) and blank cells should fall back to defaults rather than fail
// validation outright, since spreadsheets are inherently messier than a
// hand-built form payload.
export const bulkProductRowSchema = createProductSchema;

export const bulkProductImportSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1, 'No rows to import').max(500, 'Send at most 500 rows per request'),
});
