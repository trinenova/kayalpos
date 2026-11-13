import { z } from 'zod';
import { formatPickerDate } from '../../components/form/FormDatePicker';

// `supplier`/`fromOutlet` options now come from the real Supplier/Outlet
// APIs (see CreateStockReceiptPage, which builds them from
// useGetSuppliersQuery/useGetOutletsQuery) — the old mock-data version
// hardcoded both as fixed lists of specific supplier/outlet names.
// Purchase Type/Cost Center/UoM/Warehouse have no backing master table yet
// (there's no Purchase-Type/Cost-Center/Warehouse model in the schema), so
// they stay fixed, same scope decision every other module makes for its own
// non-modeled dropdowns.

export const PURCHASE_TYPE_OPTIONS = [
  { value: '', label: 'Select Purchase Type', disabled: true },
  { value: 'Purchase', label: 'Purchase' },
  { value: 'Purchase Return Reversal', label: 'Purchase Return Reversal' },
  { value: 'Consignment', label: 'Consignment' },
  { value: 'Direct Receipt', label: 'Direct Receipt' },
];

export const COST_CENTER_OPTIONS = [
  { value: '', label: 'Select Cost Center', disabled: true },
  { value: 'kitchen-operations', label: 'Kitchen Operations' },
  { value: 'housekeeping-ops', label: 'Housekeeping Operations' },
  { value: 'admin-overheads', label: 'Admin Overheads' },
];

export const UOM_OPTIONS = [
  { value: '', label: 'Select UoM', disabled: true },
  { value: 'nos', label: 'Nos' },
  { value: 'kg', label: 'Kg' },
  { value: 'ltr', label: 'Ltr' },
  { value: 'box', label: 'Box' },
];

export const WAREHOUSE_OPTIONS = [
  { value: '', label: 'Select Warehouse', disabled: true },
  { value: 'main-warehouse', label: 'Main Warehouse' },
  { value: 'store-front', label: 'Store Front' },
  { value: 'cold-storage', label: 'Cold Storage' },
];

// Dates are entered via FormDatePicker, which stores/parses the "DD Mon
// YYYY" format (e.g. "19 Sep 2026") — same convention Stock Indent/Stock
// Transfer already use for their own date defaults.
function todayFormatted() {
  return formatPickerDate(new Date());
}

// A blank grid row. Ordered/Received Qty may be pre-filled by the caller.
export function emptyItemRow({ orderedQty = '', receivedQty = '' } = {}) {
  return {
    itemCode: '',
    itemName: '',
    hsnCode: '',
    barcode: '',
    uom: '',
    orderedQty,
    receivedQty,
    unitCost: '0.00',
    discount: '0.00',
    tax: '0.00',
    warehouse: '',
    batchNo: '',
    expiryDate: '',
    remarks: '',
  };
}

// A plain non-negative decimal amount, entered as free text — same
// convention as Stock Transfer's own decimalString() helper.
const decimalString = (message) => z.string().trim()
  .refine((v) => v === '' || (/^\d+(\.\d{1,3})?$/.test(v) && Number(v) >= 0), message);

const itemRowSchema = z.object({
  itemCode: z.string().trim(),
  itemName: z.string().trim(),
  hsnCode: z.string().trim(),
  barcode: z.string().trim(),
  uom: z.string().trim(),
  orderedQty: decimalString('Enter a valid ordered quantity'),
  receivedQty: decimalString('Enter a valid received quantity'),
  unitCost: decimalString('Enter a valid unit cost'),
  discount: decimalString('Enter a valid discount'),
  tax: decimalString('Enter a valid tax'),
  warehouse: z.string().trim(),
  batchNo: z.string().trim(),
  expiryDate: z.string().trim(),
  remarks: z.string().trim(),
});

// Every row with a non-blank Item Code is part of the document — same
// "filled row" convention Stock Indent/Stock Transfer use.
export function isBlankItemRow(row) {
  return !row?.itemCode?.trim();
}

export const createStockReceiptSchema = z
  .object({
    receiptDate: z.string().trim().min(1, 'Receipt date is required'),
    purchaseType: z.string().trim().min(1, 'Select a purchase type'),
    purchaseInvoiceNo: z.string().trim().optional(),
    purchaseInvoiceDate: z.string().trim().optional(),
    grnDcNo: z.string().trim().optional(),
    grnDcDate: z.string().trim().optional(),
    receiptRemarks: z.string().trim().optional(),

    supplier: z.string().trim().min(1, 'Select a supplier'),
    fromOutlet: z.string().trim().min(1, 'Select a from outlet / HO'),
    costCenter: z.string().trim().optional(),
    contactPerson: z.string().trim().optional(),
    mobileNo: z.string().trim().optional(),

    referenceNo: z.string().trim().optional(),
    vehicleNo: z.string().trim().optional(),
    transporter: z.string().trim().optional(),
    deliveryChallanNo: z.string().trim().optional(),
    otherRemarks: z.string().trim().optional(),

    notes: z.string().trim().optional(),
    items: z.array(itemRowSchema),
  })
  .superRefine((values, ctx) => {
    const filledRows = values.items.filter((row) => !isBlankItemRow(row));
    values.items.forEach((row, index) => {
      if (isBlankItemRow(row)) return;
      if (!row.itemName?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index, 'itemName'], message: 'Item name is required' });
      }
      if (!row.receivedQty?.trim() || Number(row.receivedQty) <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index, 'receivedQty'], message: 'Received qty must be greater than 0' });
      }
    });
    if (filledRows.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: 'Add at least one item' });
    }
  });

export const createStockReceiptDefaultValues = {
  receiptDate: todayFormatted(),
  purchaseType: 'Purchase',
  purchaseInvoiceNo: '',
  purchaseInvoiceDate: '',
  grnDcNo: '',
  grnDcDate: '',
  receiptRemarks: '',

  supplier: '',
  fromOutlet: '',
  costCenter: '',
  contactPerson: '',
  mobileNo: '',

  referenceNo: '',
  vehicleNo: '',
  transporter: '',
  deliveryChallanNo: '',
  otherRemarks: '',

  notes: '',
  // One blank row to start; ReceiptItemsTable adds the next one as soon as
  // the last row gets an item.
  items: [emptyItemRow()],
};
