// TEMPORARY sample data for the Day Close screen. There is no Day Close
// backend module yet — swap these constants for RTK Query hooks (same
// pattern as the other modules' *MockData.js files) when the endpoint
// exists. Figures mirror the approved Day Close design.

export const SHIFT_INFO = {
  businessDate: '14 Oct 2026',
  businessDay: 'Wed',
  store: 'SMA Store',
  branch: 'Main Branch',
  posTerminal: 'POS-01',
  terminalLocation: 'Front Counter',
  cashier: 'Rohan',
  cashierRole: 'Cashier',
  shiftOpenedAt: '09:15 AM',
  openingCash: 2000,
};

export const OVERVIEW = {
  netSales: 24850,
  expectedCash: 8450,
  digitalPayments: 16400,
  transactions: 126,
};

export const SALES_SUMMARY = [
  { key: 'totalBills', label: 'Total Bills', value: 128, kind: 'count' },
  { key: 'cancelledBills', label: 'Cancelled Bills', value: 2, kind: 'count' },
  { key: 'grossSales', label: 'Gross Sales', value: 26480 },
  { key: 'discounts', label: 'Discounts', value: 1230 },
  { key: 'salesReturns', label: 'Sales Returns', value: 400 },
  { key: 'taxCollected', label: 'Tax Collected', value: 3720 },
];
export const NET_SALES_TOTAL = 24850;

export const PAYMENT_SUMMARY = [
  { key: 'cash', label: 'Cash', value: 8450 },
  { key: 'upi', label: 'UPI', value: 10200 },
  { key: 'card', label: 'Card', value: 6200 },
  { key: 'wallet', label: 'Wallet', value: 2000 },
  { key: 'other', label: 'Other', value: 0 },
];

export const REFUND_SUMMARY = [
  { key: 'cash', label: 'Cash Refunds', value: 200 },
  { key: 'upi', label: 'UPI Refunds', value: 100 },
  { key: 'card', label: 'Card Refunds', value: 0 },
];

// System-calculated inputs to the Cash Closing Calculator. `paidOut` is the
// only figure the cashier can still edit on the screen.
export const CASH_CALC = {
  openingCash: 2000,
  cashSales: 7000,
  cashRefunds: 200,
  cashExpenses: 350,
  paidOut: 0,
};

export const DENOMINATIONS = [
  { key: '500', label: '₹ 500', unitValue: 500, notes: 10 },
  { key: '200', label: '₹ 200', unitValue: 200, notes: 10 },
  { key: '100', label: '₹ 100', unitValue: 100, notes: 10 },
  { key: '50', label: '₹ 50', unitValue: 50, notes: 5 },
  { key: '20', label: '₹ 20', unitValue: 20, notes: 5 },
  { key: '10', label: '₹ 10', unitValue: 10, notes: 5 },
  { key: '5', label: '₹ 5', unitValue: 5, notes: 5 },
  { key: '2', label: '₹ 2', unitValue: 2, notes: 5 },
  { key: '1', label: '₹ 1', unitValue: 1, notes: 10 },
  // Loose coins are counted as a lump-sum amount rather than by piece.
  { key: 'coins', label: 'Coins', unitValue: null, notes: null, amount: 5 },
];
