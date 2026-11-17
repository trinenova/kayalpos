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

// The two things a cashier can do with goods coming back, picked once at
// the top of the Scan/Search Item card. 'return' hands money back to the
// customer (Refund To, below); 'exchange' hands back different goods
// instead, settling any price difference (see ExchangeCartPanel/
// SettlementCard) rather than touching cash for the returned items at all.
export const RETURN_TYPES = [
  { value: 'return', label: 'Return' },
  { value: 'exchange', label: 'Exchange' },
];

// Where the price difference on an exchange is settled when the new goods
// cost MORE than the returned ones — the customer is paying extra, so
// "Store Credit" (which only makes sense as a way to pay OUT, not collect)
// is left out here. Used for the "Collect Via" select.
export const SETTLEMENT_COLLECT_METHODS = REFUND_PAYMENT_METHODS.filter((m) => m.value !== 'store-credit');

// Where the price difference on an exchange is settled when the new goods
// cost LESS — the customer is owed a refund, same option set as a plain
// return's "Refund To".
export const SETTLEMENT_REFUND_METHODS = REFUND_PAYMENT_METHODS;
