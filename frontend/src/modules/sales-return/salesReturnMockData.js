/**
 * TEMPORARY mock data for the Sales Return screen. The Sales Return / Sales
 * Invoice modules haven't been built on the backend yet, so this static
 * "original invoice" + its line items stand in for
 * `useGetInvoiceQuery(invoiceNo)`. Replace with real API data once that
 * module exists — do not add more mock data here in the meantime.
 */

export const TAX_RATE = 0.05; // GST 5%, matches "Tax" line in the reference design

export const ORIGINAL_INVOICE = {
  invoiceNo: 'INV-250524-00123',
  invoiceDate: '23 May 2026',
  totalAmount: 4250,
  paidAmount: 4250,
  paymentMethod: 'Cash',
};

// Items on the original invoice, with what's still eligible to be returned.
export const RETURNABLE_ITEMS = [
  {
    id: 'KPR25', code: 'KPR25', name: 'SMA Ponni Rice 25kg', batch: 'BATCH-2405',
    uom: 'Bag', saleQty: 2, returnableQty: 2, mrp: 1950, rate: 1850, initial: 'P', color: '#F26B21',
  },
  {
    id: 'KIR25', code: 'KIR25', name: 'SMA Idly Rice 25kg', batch: 'BATCH-2405',
    uom: 'Bag', saleQty: 2, returnableQty: 2, mrp: 1800, rate: 1700, initial: 'I', color: '#22A06B',
  },
  {
    id: 'KGH01', code: 'KGH01', name: 'SMA Ghee 1L', batch: '-',
    uom: 'Nos', saleQty: 1, returnableQty: 1, mrp: 620, rate: 580, initial: 'G', color: '#F5A623',
  },
  {
    id: 'KGO01', code: 'KGO01', name: 'SMA Groundnut Oil 1L', batch: '-',
    uom: 'Nos', saleQty: 2, returnableQty: 2, mrp: 180, rate: 165, initial: 'O', color: '#2563EB',
  },
  {
    id: 'KTD01', code: 'KTD01', name: 'SMA Toor Dhal 1kg', batch: '-',
    uom: 'Pcs', saleQty: 1, returnableQty: 1, mrp: 145, rate: 135, initial: 'T', color: '#D97706',
  },
  {
    id: 'KSG01', code: 'KSG01', name: 'SMA Sugar 1kg', batch: '-',
    uom: 'Pcs', saleQty: 2, returnableQty: 2, mrp: 52, rate: 48, initial: 'S', color: '#E5484D',
  },
];

// Item codes pre-loaded into "Current Return Items" so the page opens
// matching the reference (qty here is the starting return quantity).
export const INITIAL_RETURN_CART = [
  { code: 'KPR25', qty: 1 },
  { code: 'KGH01', qty: 1 },
  { code: 'KGO01', qty: 1 },
];

export const RETURN_REASONS = [
  { value: 'damaged', label: 'Damaged / Defective' },
  { value: 'wrong-item', label: 'Wrong Item Delivered' },
  { value: 'expired', label: 'Expired / Near Expiry' },
  { value: 'customer-changed-mind', label: 'Customer Changed Mind' },
  { value: 'other', label: 'Other' },
];

export const REFUND_PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'store-credit', label: 'Store Credit' },
];

export function generateReturnNo(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `SR-${dd}${mm}${yy}-00007`;
}
