// Which API write maps to which notification. `key` is what app.js passes to
// notifyOnWrite(); category drives the icon/filter in the bell.
//   sales      — sales, returns, quotations, orders, invoices (+ stock alerts)
//   inventory  — stock indent / transfer / receipt / return / wastage / count
//   cash       — shifts, drawer, deposits, withdrawals, reconciliation
//   masters    — master data, expenses, users, company
// `stock: true` re-checks low / out-of-stock products after the write.
export const EVENTS = {
  // Sales
  'line-sale': { category: 'sales', label: 'Sale', stock: true },
  'sales-quotation': { category: 'sales', label: 'Sales quotation' },
  'sales-return': { category: 'sales', label: 'Sales return', severity: 'warning', stock: true },
  'sales-order': { category: 'sales', label: 'Sales order' },
  'sales-invoice': { category: 'sales', label: 'Sales invoice' },
  // Inventory documents
  'stock-indent': { category: 'inventory', label: 'Stock indent' },
  'stock-transfer': { category: 'inventory', label: 'Stock transfer', stock: true },
  'stock-receipt': { category: 'inventory', label: 'Stock receipt', stock: true },
  'stock-return': { category: 'inventory', label: 'Stock return', stock: true },
  'stock-wastage': { category: 'inventory', label: 'Stock wastage', severity: 'warning', stock: true },
  'stock-count': { category: 'inventory', label: 'Stock count', stock: true },
  // Cash & shifts
  'shift-session': { category: 'cash', label: 'Shift' },
  'cash-withdrawal': { category: 'cash', label: 'Cash withdrawal', severity: 'warning' },
  'cash-deposit': { category: 'cash', label: 'Cash deposit' },
  'cash-transfer': { category: 'cash', label: 'Cash transfer' },
  'cash-drawer-opening': { category: 'cash', label: 'Cash drawer opening' },
  'shift-closing': { category: 'cash', label: 'Shift closing' },
  'cash-reconciliation': { category: 'cash', label: 'Cash reconciliation' },
  'shortage-excess': { category: 'cash', label: 'Cash shortage / excess', severity: 'warning' },
  // Masters & expenses
  outlet: { category: 'masters', label: 'Outlet' },
  warehouse: { category: 'masters', label: 'Warehouse' },
  brand: { category: 'masters', label: 'Brand' },
  'item-group': { category: 'masters', label: 'Item group' },
  'uom-group': { category: 'masters', label: 'UOM group' },
  uom: { category: 'masters', label: 'UOM' },
  'tax-code': { category: 'masters', label: 'Tax code' },
  'hsn-sac': { category: 'masters', label: 'HSN / SAC' },
  product: { category: 'masters', label: 'Product', stock: true },
  'selling-price': { category: 'masters', label: 'Selling price' },
  'price-list': { category: 'masters', label: 'Price list' },
  'batch-serial': { category: 'masters', label: 'Batch / serial' },
  customer: { category: 'masters', label: 'Customer' },
  supplier: { category: 'masters', label: 'Supplier' },
  employee: { category: 'masters', label: 'Employee' },
  promotion: { category: 'masters', label: 'Promotion' },
  'gift-voucher': { category: 'masters', label: 'Gift voucher' },
  loyalty: { category: 'masters', label: 'Loyalty program' },
  expense: { category: 'masters', label: 'Expense' },
  user: { category: 'masters', label: 'User' },
  role: { category: 'masters', label: 'Role' },
  company: { category: 'masters', label: 'Company profile' },
};

// Sub-path words on POST routes (POST /:id/approve ...) -> past-tense verb.
export const VERBS = {
  approve: 'approved', reject: 'rejected', cancel: 'cancelled', void: 'voided', post: 'posted',
  submit: 'submitted', close: 'closed', open: 'opened', receive: 'received', convert: 'converted',
  complete: 'completed', finalize: 'finalized', confirm: 'confirmed', dispatch: 'dispatched',
  bulk: 'imported',
};
