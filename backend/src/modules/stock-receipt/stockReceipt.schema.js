import { z } from 'zod';

// Stock Receipt accepts anything: no field is required or range-checked.
// Unparseable numbers become 0 and unparseable dates become null; the service
// fills defaults for blank text/date columns.
const text = z.any().transform((v) => (v == null ? '' : String(v).trim()));
const num = z.any().transform((v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
});
const numOrNull = z.any().transform((v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
});
const date = z.any().transform((v) => {
  if (v == null || v === '') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
});

const itemRowSchema = z.object({
  itemCode: text.optional().default(''),
  itemName: text.optional().default(''),
  hsnCode: text.optional().default(''),
  barcode: text.optional().default(''),
  uom: text.optional().default(''),
  orderedQty: num.optional().default(0),
  receivedQty: num.optional().default(0),
  unitCost: num.optional().default(0),
  discount: num.optional().default(0),
  tax: num.optional().default(0),
  warehouse: text.optional().default(''),
  mrp: numOrNull.optional(),
  sellingPrice: numOrNull.optional(),
  batchNo: text.optional().default(''),
  expiryDate: date.optional(),
  remarks: text.optional().default(''),
});

export const createStockReceiptSchema = z.object({
  code: text.optional(),
  receiptDate: date.optional(),
  purchaseType: text.optional().default(''),
  purchaseInvoiceNo: text.optional().default(''),
  purchaseInvoiceDate: date.optional(),
  grnDcNo: text.optional().default(''),
  grnDcDate: date.optional(),
  receiptRemarks: text.optional().default(''),
  supplierId: text.optional().default(''),
  fromOutletId: text.optional().default(''),
  costCenter: text.optional().default(''),
  contactPerson: text.optional().default(''),
  mobileNo: text.optional().default(''),
  referenceNo: text.optional().default(''),
  vehicleNo: text.optional().default(''),
  transporter: text.optional().default(''),
  deliveryChallanNo: text.optional().default(''),
  deliveryDate: date.optional(),
  otherRemarks: text.optional().default(''),
  notes: text.optional().default(''),
  status: z.any().transform((v) => (String(v).toLowerCase() === 'received' ? 'received' : 'draft')).optional().default('draft'),
  items: z.array(itemRowSchema).optional().default([]),
});

export const updateStockReceiptSchema = createStockReceiptSchema;
