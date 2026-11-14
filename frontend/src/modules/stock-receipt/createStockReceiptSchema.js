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
    mrp: '',
    unitCost: '0.00',
    discount: '0.00',
    tax: '0.00',
    warehouse: '',
    batchNo: '',
    expiryDate: '',
    remarks: '',
  };
}

// Every row with a non-blank Item Code is part of the document — same
// "filled row" convention Stock Indent/Stock Transfer use.
export function isBlankItemRow(row) {
  return !row?.itemCode?.trim();
}

// Stock Receipt has no form validation: every field is optional and nothing
// blocks Save (the server fills in safe defaults for anything left blank).
export const createStockReceiptSchema = z.object({}).passthrough();

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
  deliveryDate: '',
  otherRemarks: '',

  notes: '',
  // One blank row to start; ReceiptItemsTable adds the next one as soon as
  // the last row gets an item.
  items: [emptyItemRow()],
};
