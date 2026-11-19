import { z } from 'zod';

// `itemCategory`, `item` and `brand` options now come from the real Product/
// Brand APIs (see CreateBarcodeLabelPage, which builds them from
// useGetProductsQuery/useGetBrandsQuery) — the old mock-data version
// hardcoded all three as fixed lists. The remaining lists below have no
// backing master table yet (there's no Warehouse/Print-Template model in the
// schema), so they stay fixed, same scope decision every other module makes
// for its own non-modeled dropdowns (e.g. Sales Invoice's PAYMENT_TERMS_OPTIONS).

export const LABEL_TYPE_OPTIONS = [
  { value: 'barcode', label: 'Barcode' },
  { value: 'qr-code', label: 'QR Code' },
  { value: 'price-tag', label: 'Price Tag' },
];

export const LABEL_SIZE_OPTIONS = [
  { value: '', label: 'Select Label Size', disabled: true },
  { value: '25x15', label: '25mm x 15mm' },
  { value: '50x25', label: '50mm x 25mm' },
  { value: '75x50', label: '75mm x 50mm' },
  { value: '100x50', label: '100mm x 50mm' },
];

export const PRINT_TEMPLATE_OPTIONS = [
  { value: '', label: 'Select Template', disabled: true },
  { value: 'standard-2col', label: 'Standard 2-Column' },
  { value: 'standard-3col', label: 'Standard 3-Column' },
  { value: 'compact-4col', label: 'Compact 4-Column' },
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

export const BARCODE_TYPE_OPTIONS = [
  { value: 'ean-13', label: 'EAN-13' },
  { value: 'code-128', label: 'CODE-128' },
  { value: 'upc-a', label: 'UPC-A' },
  { value: 'qr', label: 'QR' },
];

export const ADDITIONAL_FILTER_OPTIONS = [
  { value: '', label: 'Select' },
  { value: 'low-stock', label: 'Low Stock Items Only' },
  { value: 'no-barcode', label: 'Items Without Barcode' },
  { value: 'new-arrivals', label: 'New Arrivals' },
];

export const SORT_BY_OPTIONS = [
  { value: 'item-name', label: 'Item Name' },
  { value: 'item-code', label: 'Item Code' },
  { value: 'category', label: 'Category' },
];

export function emptyItemRow() {
  return {
    // The grid has no checkbox column any more, so every row is part of the
    // batch from the moment it exists.
    selected: true,
    itemCode: '',
    itemName: '',
    hsnCode: '',
    uom: '',
    barcode: '',
    printQty: '1.00',
    fromSerialBatch: '',
    toSerialBatch: '',
  };
}

// A plain (optional) non-negative decimal amount, entered as free text —
// same convention as the sales-cycle modules' own decimalString() helper.
const decimalString = (message) => z.string().trim()
  .refine((v) => v === '' || (/^\d+(\.\d{1,3})?$/.test(v) && Number(v) >= 0), message);

const itemRowSchema = z.object({
  selected: z.boolean(),
  itemCode: z.string().trim().optional(),
  itemName: z.string().trim().optional(),
  hsnCode: z.string().trim().optional(),
  uom: z.string().trim().optional(),
  barcode: z.string().trim().optional(),
  printQty: decimalString('Enter a valid print quantity'),
  fromSerialBatch: z.string().trim().optional(),
  toSerialBatch: z.string().trim().optional(),
});

// Unlike Quotation/Order/Invoice's items grid (where every filled row is
// part of the document), a Barcode & Label batch only ever includes the rows
// the user actually checked — see LabelPrintSummaryCard's own selected-only
// totals, which this validation mirrors exactly. An unchecked row, filled or
// not, is never part of what gets submitted or validated beyond its own
// print-qty format.
function isSelectedRow(row) {
  return Boolean(row?.selected);
}

export const createBarcodeLabelSchema = z
  .object({
    labelName: z.string().trim().min(1, 'Label name is required'),
    labelType: z.string().trim().min(1, 'Select a label type'),
    labelSize: z.string().trim().min(1, 'Select a label size'),
    printTemplate: z.string().trim().optional(),
    labelsAcross: decimalString('Enter a valid whole number')
      .refine((v) => v === '' || Number.isInteger(Number(v)), 'Must be a whole number'),
    labelsDown: decimalString('Enter a valid whole number')
      .refine((v) => v === '' || Number.isInteger(Number(v)), 'Must be a whole number'),
    remarks: z.string().trim().optional(),
    itemCategory: z.string().trim().optional(),
    item: z.string().trim().optional(),
    uom: z.string().trim().optional(),
    brand: z.string().trim().optional(),
    warehouse: z.string().trim().optional(),
    batchNo: z.string().trim().optional(),
    fromItemCode: z.string().trim().optional(),
    toItemCode: z.string().trim().optional(),
    barcodeType: z.string().trim().min(1, 'Select a barcode type'),
    additionalFilter: z.string().trim().optional(),
    sortBy: z.string().trim().min(1, 'Select a sort order'),
    notes: z.string().trim().optional(),
    items: z.array(itemRowSchema),
  })
  .superRefine((values, ctx) => {
    const selectedRows = values.items.filter(isSelectedRow);
    values.items.forEach((row, index) => {
      if (!isSelectedRow(row)) return;
      if (!row.itemCode?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index, 'itemCode'], message: 'Item code is required' });
      }
      if (!row.itemName?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index, 'itemName'], message: 'Item name is required' });
      }
      if (!row.printQty?.trim() || Number(row.printQty) <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index, 'printQty'], message: 'Print qty must be greater than 0' });
      }
    });
    if (selectedRows.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: 'Select at least one item to print' });
    }
  });

export const createBarcodeLabelDefaultValues = {
  labelName: '',
  labelType: 'barcode',
  labelSize: '',
  printTemplate: '',
  labelsAcross: '',
  labelsDown: '',
  remarks: '',
  itemCategory: '',
  item: '',
  uom: '',
  brand: '',
  warehouse: '',
  batchNo: '',
  fromItemCode: '',
  toItemCode: '',
  barcodeType: 'ean-13',
  additionalFilter: '',
  sortBy: 'item-name',
  notes: '',
  items: [emptyItemRow()],
};
