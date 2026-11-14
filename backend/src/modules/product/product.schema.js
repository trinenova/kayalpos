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

// One row of a bulk Excel/CSV import. Imports are deliberately lenient: no
// per-field validation rules apply. Whatever the sheet gives is accepted and
// coerced (bad/blank numbers -> 0, any status text other than "inactive" ->
// ACTIVE, decimals in qty are rounded). Only the columns actually present in
// the row are returned, so re-importing a sheet with fewer columns never wipes
// the other fields of an existing product. Missing Group/UOM fall back to
// 'General'/'PCS' (the database needs a value), and a missing Name falls back
// to the code/barcode/short id.
const STRING_FIELDS = [
  'code', 'shortId', 'name', 'foreignName', 'group', 'productType', 'productSubGroup', 'brand', 'packSize',
  'uom', 'uomGroup', 'hsnSac', 'taxCode', 'taxGroup', 'priceList', 'preferredVendor', 'purchasingUom',
  'salesUom', 'barcode', 'additionalIdentifier', 'shippingType', 'remarks', 'manageItemBy', 'manageMethod',
];
const BOOL_FIELDS = ['isSalesItem', 'isPurchaseItem', 'isInventoryItem', 'isExcisable', 'isGst'];
const toNum = (v) => {
  const n = Number(String(v ?? '').replace(/[,₹\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const toBool = (v) => !['false', '0', 'no', 'n', 'off', ''].includes(String(v).trim().toLowerCase());
const has = (row, key) => row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '';

/** Returns the lenient product data for one sheet row, or null for a row with nothing in it. */
export function normalizeBulkProductRow(row, { isNew = true } = {}) {
  if (!row || typeof row !== 'object') return null;
  const data = {};
  STRING_FIELDS.forEach((k) => { if (has(row, k)) data[k] = String(row[k]).trim(); });
  BOOL_FIELDS.forEach((k) => { if (has(row, k)) data[k] = toBool(row[k]); });
  ['unitPrice', 'salePrice', 'mrp'].forEach((k) => { if (has(row, k)) data[k] = toNum(row[k]); });
  if (has(row, 'availableQty')) data.availableQty = Math.round(toNum(row.availableQty));
  if (has(row, 'status')) data.status = String(row.status).trim().toLowerCase() === 'inactive' ? 'INACTIVE' : 'ACTIVE';
  if (Object.keys(data).length === 0) return null;
  if (isNew) {
    if (!data.name) data.name = data.barcode || data.code || data.shortId || 'Unnamed item';
    if (!data.group) data.group = 'General';
    if (!data.uom) data.uom = 'PCS';
  }
  return data;
}

export const bulkProductRowSchema = z.record(z.string(), z.unknown());

export const bulkProductImportSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1, 'No rows to import').max(500, 'Send at most 500 rows per request'),
});
