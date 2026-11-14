/**
 * Fixed option lists for the Sales Return form — these are dropdown choices,
 * not business data, so they aren't something a real backend module would
 * ever "replace". Values must match backend/src/modules/sales-return's
 * createSalesReturnSchema.js enums exactly.
 */

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
