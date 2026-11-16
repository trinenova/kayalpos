/**
 * TEMPORARY mock data for the Cashier Panel module. There's no Cashier
 * Panel backend module yet (shift/cash-drawer tracking isn't modeled in
 * the API), so this static snapshot stands in for
 * `useGetCashierPanelQuery()`. Replace with real API data once that
 * module exists — do not add more mock data here in the meantime.
 */

export const CASHIER = { name: 'Karthik', code: 'C001' };

export const SHIFT = {
  status: 'OPEN',
  openedAt: '01:09 AM',
  openedDate: '26/05/2026',
  id: 'SHF-00027',
  openedOn: '26/05/2026 01:09 AM',
  cashier: 'Karthik (C001)',
  openingCash: 5000.00,
  openingCashBy: 'Karthik (C001)',
};

export const STATS = {
  cashInHand: { value: 8750.00, expected: 8750.00 },
  todaysSales: { value: 12650.00, transactions: 28 },
  todaysReceipt: { value: 12650.00, refunds: 0.00 },
};

export const PAYMENT_SUMMARY = {
  breakdown: [
    { key: 'cash', label: 'Cash Sales', value: 8450.00, color: '#22A06B' },
    { key: 'card', label: 'Card Sales', value: 2200.00, color: '#2563EB' },
    { key: 'upi', label: 'UPI Sales', value: 1650.00, color: '#8B5CF6' },
    { key: 'other', label: 'Other Payments', value: 350.00, color: '#1F2A3C' },
  ],
  totalSales: 12650.00,
};

export const CASH_SUMMARY = {
  openingCash: 5000.00,
  cashReceived: 8450.00,
  cashWithdrawal: 700.00,
  cashDeposit: 0.00,
  cashTransferIn: 0.00,
  cashTransferOut: 0.00,
  expectedCashInHand: 12750.00,
};

export const RECENT_TRANSACTIONS = [
  { id: 'INV-000645', type: 'Cash Sale', ref: 'INV-000645', time: '10:15 AM', amount: 420.00, color: '#22A06B' },
  { id: 'INV-000644', type: 'Card Sale', ref: 'INV-000644', time: '10:05 AM', amount: 680.00, color: '#2563EB' },
  { id: 'INV-000643', type: 'UPI Sale', ref: 'INV-000643', time: '09:58 AM', amount: 250.00, color: '#8B5CF6' },
  { id: 'CW-000007', type: 'Cash Withdrawal', ref: 'CW-000007', time: '09:30 AM', amount: 500.00, color: '#F26B21' },
  { id: 'CDP-000005', type: 'Cash Deposit', ref: 'CDP-000005', time: '09:10 AM', amount: 1000.00, color: '#22A06B' },
];

export const QUICK_INFO = [
  'Use PIN login for secure operations.',
  'Please perform Shift Closing & Reconciliation at the end of the day.',
  'Ensure cash in hand matches with expected amount.',
];

export const ALERTS = [
  { severity: 'error', message: 'You have 2 Pending Transactions.' },
  { severity: 'info', message: 'Please reconcile cash before closing shift.' },
];

export const LOGIN_OUTLET = {
  name: 'SMA - Main Outlet',
  code: 'OUT-0001',
  address: '123, Main Road,\nCoimbatore - 641001\nTamil Nadu, India',
  phone: '+91 422 1234567',
  email: 'info@sma.com',
};

export const SHIFT_OPENING = {
  currentDateTime: '26/05/2026 01:09 AM',
  weekday: 'Monday',
  currentStatus: 'CLOSED',
  currentStatusCaption: 'No active shift',
  lastClosed: { date: '25/05/2026 (01)', caption: 'Closed at 10:15 PM' },
  nextShiftNo: '02',
  defaultShiftName: 'Morning Shift',
  defaultStartTime: '01:09 AM',
  defaultEndTime: '10:00 PM',
  previousClosingCash: 10450.00,
};

// Fixed-value denominations compute their Amount as pieces × value; the
// "Coins" row bundles several small denominations together so it has no
// single unit value — its amount is entered directly instead of computed.
export const DENOMINATIONS = [
  { key: 'd2000', label: '₹ 2,000', unitValue: 2000, pieces: 2 },
  { key: 'd500', label: '₹ 500', unitValue: 500, pieces: 4 },
  { key: 'd200', label: '₹ 200', unitValue: 200, pieces: 10 },
  { key: 'd100', label: '₹ 100', unitValue: 100, pieces: 20 },
  { key: 'd50', label: '₹ 50', unitValue: 50, pieces: 10 },
  { key: 'd20', label: '₹ 20', unitValue: 20, pieces: 10 },
  { key: 'd10', label: '₹ 10', unitValue: 10, pieces: 10 },
  { key: 'coins', label: 'Coins (₹1, ₹2, ₹5)', unitValue: null, pieces: 25, amount: 150.00 },
];

export const SHIFT_TERMS = [
  'Please count and verify opening cash before starting the shift.',
  'You will be responsible for the cash in hand during this shift.',
  'Ensure to close the shift at the end of the day.',
];

export const CASH_SALES = {
  stats: {
    totalCashSales: { value: 12650.00, transactions: 28 },
    totalItemsSold: { value: 156, totalQty: 248.000 },
    avgInvoiceValue: { value: 451.79 },
    todaysCashSales: { value: 12650.00, transactions: 28 },
    selectedDateSales: { value: 12650.00, date: '26/05/2026' },
  },
  selectedDate: '26/05/2026',
  summary: {
    grossSales: 12650.00,
    discount: 0.00,
    taxableAmount: 12650.00,
    cgstRate: 2.5,
    cgstAmount: 316.25,
    sgstRate: 2.5,
    sgstAmount: 316.25,
    grandTotal: 13282.50,
  },
  payment: {
    cashReceived: 12650.00,
    otherPayments: 0.00,
    totalReceived: 12650.00,
    refunds: 0.00,
  },
  donut: [
    { id: 'cash', label: 'Cash', value: 12650.00, color: '#22A06B' },
    { id: 'card', label: 'Card', value: 0.00, color: '#2563EB' },
    { id: 'upi', label: 'UPI', value: 0.00, color: '#8B5CF6' },
    { id: 'other', label: 'Other Payments', value: 0.00, color: '#F5A623' },
  ],
  totalPages: 6,
  transactions: [
    { invoiceNo: 'CS-260526-0028', dateTime: '26/05/2026 02:15 PM', items: 4, qty: 6.000, discount: 0.00, tax: 20.90, totalAmount: 438.90, received: 438.90, paymentMode: 'Cash', cashier: 'Karthik (C001)' },
    { invoiceNo: 'CS-260526-0027', dateTime: '26/05/2026 02:02 PM', items: 5, qty: 9.000, discount: 0.00, tax: 15.45, totalAmount: 324.45, received: 324.45, paymentMode: 'Cash', cashier: 'Karthik (C001)' },
    { invoiceNo: 'CS-260526-0026', dateTime: '26/05/2026 01:47 PM', items: 3, qty: 4.000, discount: 0.00, tax: 9.75, totalAmount: 204.75, received: 204.75, paymentMode: 'Cash', cashier: 'Karthik (C001)' },
    { invoiceNo: 'CS-260526-0025', dateTime: '26/05/2026 01:32 PM', items: 6, qty: 11.000, discount: 0.00, tax: 28.60, totalAmount: 600.60, received: 600.60, paymentMode: 'Cash', cashier: 'Karthik (C001)' },
    { invoiceNo: 'CS-260526-0024', dateTime: '26/05/2026 01:18 PM', items: 2, qty: 2.000, discount: 0.00, tax: 6.20, totalAmount: 130.20, received: 130.20, paymentMode: 'Cash', cashier: 'Karthik (C001)' },
  ],
};

export const CARD_SALES = {
  stats: {
    totalCardSales: { value: 8450.00, transactions: 18 },
    totalItemsSold: { value: 112, totalQty: 168.000 },
    avgInvoiceValue: { value: 469.44 },
    todaysCardSales: { value: 8450.00, transactions: 18 },
    selectedDateSales: { value: 8450.00, date: '26/05/2026' },
  },
  selectedDate: '26/05/2026',
  summary: {
    grossSales: 8450.00,
    discount: 0.00,
    taxableAmount: 8450.00,
    cgstRate: 2.5,
    cgstAmount: 211.25,
    sgstRate: 2.5,
    sgstAmount: 211.25,
    grandTotal: 8872.50,
  },
  payment: {
    cardReceived: 8450.00,
    otherPayments: 0.00,
    totalReceived: 8450.00,
    refunds: 0.00,
  },
  donut: [
    { id: 'card', label: 'Card', value: 8450.00, color: '#22A06B' },
    { id: 'cash', label: 'Cash', value: 0.00, color: '#F5A623' },
    { id: 'upi', label: 'UPI', value: 0.00, color: '#8B5CF6' },
    { id: 'other', label: 'Other Payments', value: 0.00, color: '#2563EB' },
  ],
  totalPages: 4,
  transactions: [
    { invoiceNo: 'CS-260526-0018', dateTime: '26/05/2026 02:12 PM', items: 3, qty: 5.000, discount: 0.00, tax: 15.90, totalAmount: 667.80, received: 667.80, cardType: 'VISA', cardLast4: '1234', bank: 'HDFC Bank', cashier: 'Karthik (C001)' },
    { invoiceNo: 'CS-260526-0017', dateTime: '26/05/2026 01:58 PM', items: 5, qty: 7.000, discount: 0.00, tax: 21.18, totalAmount: 889.56, received: 889.56, cardType: 'Mastercard', cardLast4: '5678', bank: 'ICICI Bank', cashier: 'Karthik (C001)' },
    { invoiceNo: 'CS-260526-0016', dateTime: '26/05/2026 01:35 PM', items: 2, qty: 3.000, discount: 0.00, tax: 10.05, totalAmount: 422.10, received: 422.10, cardType: 'RuPay', cardLast4: '9012', bank: 'SBI Bank', cashier: 'Karthik (C001)' },
    { invoiceNo: 'CS-260526-0015', dateTime: '26/05/2026 01:10 PM', items: 6, qty: 10.000, discount: 0.00, tax: 29.65, totalAmount: 1244.65, received: 1244.65, cardType: 'VISA', cardLast4: '3456', bank: 'HDFC Bank', cashier: 'Karthik (C001)' },
    { invoiceNo: 'CS-260526-0014', dateTime: '26/05/2026 12:45 PM', items: 4, qty: 6.000, discount: 0.00, tax: 17.70, totalAmount: 743.70, received: 743.70, cardType: 'Mastercard', cardLast4: '7890', bank: 'Axis Bank', cashier: 'Karthik (C001)' },
  ],
};

export const UPI_SALES = {
  stats: {
    totalUpiSales: { value: 6720.00, transactions: 21 },
    totalItemsSold: { value: 98, totalQty: 142.000 },
    avgInvoiceValue: { value: 320.00 },
    todaysUpiSales: { value: 6720.00, transactions: 21 },
    selectedDateSales: { value: 6720.00, date: '26/05/2026' },
  },
  selectedDate: '26/05/2026',
  summary: {
    grossSales: 6720.00,
    discount: 0.00,
    taxableAmount: 6720.00,
    cgstRate: 2.5,
    cgstAmount: 168.00,
    sgstRate: 2.5,
    sgstAmount: 168.00,
    grandTotal: 7056.00,
  },
  payment: {
    upiReceived: 6720.00,
    otherPayments: 0.00,
    totalReceived: 6720.00,
    refunds: 0.00,
  },
  donut: [
    { id: 'upi', label: 'UPI', value: 6720.00, color: '#8B5CF6' },
    { id: 'cash', label: 'Cash', value: 0.00, color: '#22A06B' },
    { id: 'card', label: 'Card', value: 0.00, color: '#2563EB' },
    { id: 'other', label: 'Other Payments', value: 0.00, color: '#F5A623' },
  ],
  totalPages: 5,
  transactions: [
    { invoiceNo: 'CS-260526-0021', dateTime: '26/05/2026 02:08 PM', items: 4, qty: 6.000, discount: 0.00, tax: 20.20, totalAmount: 424.20, received: 424.20, upiApp: 'PhonePe', upiTxnId: 'T2605261408123456', cashier: 'Karthik (C001)' },
    { invoiceNo: 'CS-260526-0020', dateTime: '26/05/2026 01:54 PM', items: 3, qty: 4.000, discount: 0.00, tax: 13.45, totalAmount: 282.45, received: 282.45, upiApp: 'GPay', upiTxnId: 'T2605261354123456', cashier: 'Karthik (C001)' },
    { invoiceNo: 'CS-260526-0019', dateTime: '26/05/2026 01:32 PM', items: 6, qty: 8.000, discount: 0.00, tax: 24.60, totalAmount: 516.60, received: 516.60, upiApp: 'Paytm', upiTxnId: 'T2605261332123456', cashier: 'Karthik (C001)' },
    { invoiceNo: 'CS-260526-0013', dateTime: '26/05/2026 12:28 PM', items: 2, qty: 2.000, discount: 0.00, tax: 6.15, totalAmount: 129.15, received: 129.15, upiApp: 'BHIM', upiTxnId: 'T2605261228123456', cashier: 'Karthik (C001)' },
    { invoiceNo: 'CS-260526-0011', dateTime: '26/05/2026 11:48 AM', items: 5, qty: 7.000, discount: 0.00, tax: 18.90, totalAmount: 396.90, received: 396.90, upiApp: 'PhonePe', upiTxnId: 'T2605261148123456', cashier: 'Karthik (C001)' },
  ],
};

export const OTHER_PAYMENTS = {
  stats: {
    totalOtherPayments: { value: 2435.00, transactions: 16 },
    totalItemsSold: { value: 56, totalQty: 78.000 },
    avgInvoiceValue: { value: 152.19 },
    todaysOtherPayments: { value: 2435.00, transactions: 16 },
    selectedDateSales: { value: 2435.00, date: '26/05/2026' },
  },
  selectedDate: '26/05/2026',
  summary: {
    grossSales: 2435.00,
    discount: 0.00,
    taxableAmount: 2435.00,
    cgstRate: 2.5,
    cgstAmount: 60.88,
    sgstRate: 2.5,
    sgstAmount: 60.88,
    grandTotal: 2556.76,
  },
  payment: {
    otherPaymentsReceived: 2435.00,
    cash: 0.00,
    card: 0.00,
    upi: 0.00,
    totalReceived: 2435.00,
    refunds: 0.00,
  },
  donut: [
    { id: 'other', label: 'Other Payments', value: 2435.00, color: '#F5A623' },
    { id: 'cash', label: 'Cash', value: 0.00, color: '#22A06B' },
    { id: 'card', label: 'Card', value: 0.00, color: '#2563EB' },
    { id: 'upi', label: 'UPI', value: 0.00, color: '#8B5CF6' },
  ],
  totalPages: 4,
  transactions: [
    { invoiceNo: 'CS-260526-0017', dateTime: '26/05/2026 02:20 PM', items: 2, qty: 3.000, discount: 0.00, tax: 9.75, totalAmount: 204.75, received: 204.75, paymentMode: 'Store Credit', reference: 'Loyalty Redemption', cashier: 'Karthik (C001)' },
    { invoiceNo: 'CS-260526-0016', dateTime: '26/05/2026 01:55 PM', items: 3, qty: 4.000, discount: 0.00, tax: 12.60, totalAmount: 264.60, received: 264.60, paymentMode: 'Gift Card', reference: 'GC-4587', cashier: 'Karthik (C001)' },
    { invoiceNo: 'CS-260526-0015', dateTime: '26/05/2026 01:20 PM', items: 1, qty: 2.000, discount: 0.00, tax: 4.00, totalAmount: 84.00, received: 84.00, paymentMode: 'Wallet', reference: 'Wallet Payment', cashier: 'Karthik (C001)' },
    { invoiceNo: 'CS-260526-0012', dateTime: '26/05/2026 12:40 PM', items: 4, qty: 5.000, discount: 0.00, tax: 15.75, totalAmount: 330.75, received: 330.75, paymentMode: 'Cheque', reference: 'CHQ-001245', cashier: 'Karthik (C001)' },
    { invoiceNo: 'CS-260526-0010', dateTime: '26/05/2026 11:35 AM', items: 2, qty: 3.000, discount: 0.00, tax: 7.20, totalAmount: 151.20, received: 151.20, paymentMode: 'Bank Transfer', reference: 'HDFC-125632', cashier: 'Karthik (C001)' },
  ],
};

export const CASH_WITHDRAWAL = {
  stats: {
    totalCashWithdrawal: { value: 5600.00, transactions: 12 },
    totalWithdrawals: { value: 12 },
    avgWithdrawalValue: { value: 466.67 },
    todaysWithdrawal: { value: 5600.00, transactions: 12 },
    selectedDateWithdrawal: { value: 5600.00, date: '26/05/2026' },
  },
  selectedDate: '26/05/2026',
  summary: {
    totalCashWithdrawal: 5600.00,
    totalTransactions: 12,
    totalWithdrawnBy: 'Karthik (C001)',
    openingCash: 25000.00,
    totalSalesAllModes: 32405.00,
    closingCashActual: 19845.00,
  },
  byPurpose: [
    { id: 'bank-deposit', label: 'Bank Deposit', value: 4000.00, color: '#22A06B' },
    { id: 'owner-withdrawal', label: 'Owner Withdrawal', value: 1000.00, color: '#F5A623' },
    { id: 'petty-cash', label: 'Petty Cash', value: 400.00, color: '#2563EB' },
    { id: 'other-purpose', label: 'Other Purpose', value: 200.00, color: '#8B5CF6' },
  ],
  totalPages: 3,
  transactions: [
    { dateTime: '26/05/2026 03:45 PM', referenceNo: 'WD-260526-0012', purpose: 'Bank Deposit', withdrawnBy: 'Karthik (C001)', amount: 2000.00, paymentMode: 'Cash', remarks: 'Deposited to HDFC Bank - A/c 1234567890' },
    { dateTime: '26/05/2026 02:30 PM', referenceNo: 'WD-260526-0011', purpose: 'Owner Withdrawal', withdrawnBy: 'Karthik (C001)', amount: 1000.00, paymentMode: 'Cash', remarks: 'Owner personal use' },
    { dateTime: '26/05/2026 01:15 PM', referenceNo: 'WD-260526-0010', purpose: 'Bank Deposit', withdrawnBy: 'Karthik (C001)', amount: 1000.00, paymentMode: 'Cash', remarks: 'Deposited to ICICI Bank - A/c 5678901234' },
    { dateTime: '26/05/2026 12:05 PM', referenceNo: 'WD-260526-0009', purpose: 'Petty Cash', withdrawnBy: 'Karthik (C001)', amount: 400.00, paymentMode: 'Cash', remarks: 'For store petty expenses' },
    { dateTime: '26/05/2026 11:20 AM', referenceNo: 'WD-260526-0008', purpose: 'Other Purpose', withdrawnBy: 'Karthik (C001)', amount: 200.00, paymentMode: 'Cash', remarks: 'Staff refreshment' },
  ],
};

export const CASH_DEPOSIT = {
  stats: {
    totalCashDeposit: { value: 8750.00, transactions: 15 },
    totalDeposits: { value: 15 },
    avgDepositValue: { value: 583.33 },
    todaysCashDeposit: { value: 8750.00, transactions: 15 },
    selectedDateDeposit: { value: 8750.00, date: '26/05/2026' },
  },
  selectedDate: '26/05/2026',
  summary: {
    totalCashDeposit: 8750.00,
    totalTransactions: 15,
    totalDepositedBy: 'Karthik (C001)',
    openingCash: 25000.00,
    totalSalesAllModes: 32405.00,
    closingCashActual: 19845.00,
  },
  byPurpose: [
    { id: 'bank-deposit', label: 'Bank Deposit', value: 6000.00, color: '#22A06B' },
    { id: 'owner-deposit', label: 'Owner Deposit', value: 1500.00, color: '#F5A623' },
    { id: 'float-adjustment', label: 'Float Adjustment', value: 750.00, color: '#2563EB' },
    { id: 'other-purpose', label: 'Other Purpose', value: 500.00, color: '#8B5CF6' },
  ],
  totalPages: 3,
  transactions: [
    { dateTime: '26/05/2026 04:10 PM', referenceNo: 'DP-260526-0015', purpose: 'Bank Deposit', depositedBy: 'Karthik (C001)', amount: 3000.00, paymentMode: 'Cash', bankAccount: 'HDFC Bank - A/c 1234567890', remarks: 'Daily sales deposit' },
    { dateTime: '26/05/2026 03:20 PM', referenceNo: 'DP-260526-0014', purpose: 'Owner Deposit', depositedBy: 'Karthik (C001)', amount: 1500.00, paymentMode: 'Cash', bankAccount: 'Owner Personal A/c', remarks: 'Owner additional deposit' },
    { dateTime: '26/05/2026 02:05 PM', referenceNo: 'DP-260526-0013', purpose: 'Float Adjustment', depositedBy: 'Karthik (C001)', amount: 750.00, paymentMode: 'Cash', bankAccount: 'Cashier Float A/c', remarks: 'Float increased' },
    { dateTime: '26/05/2026 01:30 PM', referenceNo: 'DP-260526-0012', purpose: 'Bank Deposit', depositedBy: 'Karthik (C001)', amount: 2000.00, paymentMode: 'Cash', bankAccount: 'ICICI Bank - A/c 5678901234', remarks: 'Cash sales deposit' },
    { dateTime: '26/05/2026 12:15 PM', referenceNo: 'DP-260526-0011', purpose: 'Other Purpose', depositedBy: 'Karthik (C001)', amount: 500.00, paymentMode: 'Cash', bankAccount: 'Petty Cash A/c', remarks: 'For petty cash expenses' },
  ],
};

export const CASH_DRAWER_OPENING = {
  stats: {
    totalDrawerOpenings: { value: 6800.00, transactions: 8 },
    totalOpenings: { value: 8 },
    avgOpeningValue: { value: 850.00 },
    todaysDrawerOpening: { value: 6800.00, transactions: 8 },
    selectedDateOpening: { value: 6800.00, date: '26/05/2026' },
  },
  selectedDate: '26/05/2026',
  summary: {
    totalDrawerOpening: 6800.00,
    totalTransactions: 8,
    totalOpenedBy: 'Karthik (C001)',
    cashGiven: 6800.00,
    closingCashActual: 19845.00,
    variance: 0.00,
  },
  byTime: [
    { id: 'before-9am', label: 'Before 9:00 AM', value: 1500.00, color: '#22A06B' },
    { id: '9am-12pm', label: '9:00 AM - 12:00 PM', value: 2300.00, color: '#F26B21' },
    { id: '12pm-3pm', label: '12:00 PM - 3:00 PM', value: 2000.00, color: '#2563EB' },
    { id: 'after-3pm', label: 'After 3:00 PM', value: 1000.00, color: '#8B5CF6' },
  ],
  totalPages: 2,
  transactions: [
    { dateTime: '26/05/2026 08:45 AM', referenceNo: 'CDO-260526-0008', openedBy: 'Karthik (C001)', openingType: 'Shift Start - Morning', amount: 1500.00, remarks: 'Morning shift drawer opening', status: 'Completed' },
    { dateTime: '26/05/2026 11:15 AM', referenceNo: 'CDO-260526-0007', openedBy: 'Karthik (C001)', openingType: 'Additional Opening', amount: 500.00, remarks: 'Additional cash for rush hour', status: 'Completed' },
    { dateTime: '26/05/2026 01:00 PM', referenceNo: 'CDO-260526-0006', openedBy: 'Karthik (C001)', openingType: 'Shift Start - Afternoon', amount: 2000.00, remarks: 'Afternoon shift drawer opening', status: 'Completed' },
    { dateTime: '26/05/2026 03:45 PM', referenceNo: 'CDO-260526-0005', openedBy: 'Karthik (C001)', openingType: 'Additional Opening', amount: 1000.00, remarks: 'Additional cash for sales', status: 'Completed' },
    { dateTime: '26/05/2026 06:15 PM', referenceNo: 'CDO-260526-0004', openedBy: 'Karthik (C001)', openingType: 'Shift Start - Evening', amount: 1500.00, remarks: 'Evening shift drawer opening', status: 'Completed' },
    { dateTime: '26/05/2026 08:30 PM', referenceNo: 'CDO-260526-0003', openedBy: 'Karthik (C001)', openingType: 'Additional Opening', amount: 200.00, remarks: 'Extra cash for closing time', status: 'Completed' },
    { dateTime: '26/05/2026 09:30 PM', referenceNo: 'CDO-260526-0002', openedBy: 'Karthik (C001)', openingType: 'Additional Opening', amount: 600.00, remarks: 'Additional cash for late sales', status: 'Completed' },
    { dateTime: '26/05/2026 10:15 PM', referenceNo: 'CDO-260526-0001', openedBy: 'Karthik (C001)', openingType: 'Shift Start - Night', amount: 500.00, remarks: 'Night shift drawer opening', status: 'Completed' },
  ],
};

export const SHIFT_CLOSING = {
  stats: {
    totalShiftClosings: { value: 34560.00, transactions: 6 },
    totalClosings: { value: 6 },
    avgClosingValue: { value: 5760.00 },
    todaysShiftClosing: { value: 34560.00, transactions: 6 },
    selectedDateClosing: { value: 34560.00, date: '26/05/2026' },
  },
  selectedDate: '26/05/2026',
  summary: {
    totalShiftClosing: 34560.00,
    totalTransactions: 6,
    totalClosedBy: 'Karthik (C001)',
    totalSalesAllModes: 32405.00,
    cashInDrawerActual: 19845.00,
    expectedCash: 19845.00,
    variance: 0.00,
  },
  byShift: [
    { id: 'shift-1-morning', label: 'Shift 1 (Morning)', value: 9600.00, color: '#22A06B' },
    { id: 'shift-2-afternoon', label: 'Shift 2 (Afternoon)', value: 11250.00, color: '#F26B21' },
    { id: 'shift-3-evening', label: 'Shift 3 (Evening)', value: 8650.00, color: '#2563EB' },
    { id: 'shift-4-night', label: 'Shift 4 (Night)', value: 5060.00, color: '#8B5CF6' },
  ],
  totalPages: 1,
  transactions: [
    { dateTime: '26/05/2026 10:00 AM', referenceNo: 'SC-260526-0006', shift: 'Shift 1 - Morning', closedBy: 'Karthik (C001)', closingCash: 9600.00, totalSales: 9400.00, paymentModes: 'Cash, Card, UPI, Other', remarks: 'Morning shift closing', status: 'Closed' },
    { dateTime: '26/05/2026 02:00 PM', referenceNo: 'SC-260526-0005', shift: 'Shift 2 - Afternoon', closedBy: 'Karthik (C001)', closingCash: 11250.00, totalSales: 10980.00, paymentModes: 'Cash, Card, UPI, Other', remarks: 'Afternoon shift closing', status: 'Closed' },
    { dateTime: '26/05/2026 06:00 PM', referenceNo: 'SC-260526-0004', shift: 'Shift 3 - Evening', closedBy: 'Karthik (C001)', closingCash: 8650.00, totalSales: 8200.00, paymentModes: 'Cash, Card, UPI, Other', remarks: 'Evening shift closing', status: 'Closed' },
    { dateTime: '26/05/2026 10:00 PM', referenceNo: 'SC-260526-0003', closedBy: 'Karthik (C001)', shift: 'Shift 4 - Night', closingCash: 5060.00, totalSales: 4950.00, paymentModes: 'Cash, Card, UPI, Other', remarks: 'Night shift closing', status: 'Closed' },
    { dateTime: '25/05/2026 10:00 PM', referenceNo: 'SC-250526-0004', shift: 'Shift 4 - Night', closedBy: 'Karthik (C001)', closingCash: 4800.00, totalSales: 4650.00, paymentModes: 'Cash, Card, UPI, Other', remarks: 'Night shift closing', status: 'Closed' },
    { dateTime: '25/05/2026 06:00 PM', referenceNo: 'SC-250526-0003', shift: 'Shift 3 - Evening', closedBy: 'Karthik (C001)', closingCash: 5200.00, totalSales: 5225.00, paymentModes: 'Cash, Card, UPI, Other', remarks: 'Evening shift closing', status: 'Closed' },
  ],
};

export const CASH_RECONCILIATION = {
  stats: {
    totalReconciliations: { value: 34245.00, transactions: 5 },
    totalReconciled: { value: 5 },
    avgVariance: { value: 5.00 },
    todaysReconciliation: { value: 8650.00, transactions: 1 },
    selectedDateReconciliation: { value: 8650.00, date: '26/05/2026' },
  },
  selectedDate: '26/05/2026',
  summary: {
    totalReconciliation: 34245.00,
    totalTransactions: 5,
    reconciledBy: 'Karthik (C001)',
    totalSystemCash: 34250.00,
    totalCountedCash: 34245.00,
    totalVariance: -5.00,
    variancePercent: -0.01,
    cashShortOver: 'Short',
    status: 'Balanced',
  },
  byType: [
    { id: 'cash-short', label: 'Cash Short', count: 2, value: -10.00, color: '#22A06B' },
    { id: 'cash-over', label: 'Cash Over', count: 1, value: 15.00, color: '#F26B21' },
    { id: 'exact-match', label: 'Exact Match', count: 2, value: 0.00, color: '#2563EB' },
  ],
  totalPages: 1,
  transactions: [
    { dateTime: '26/05/2026 09:30 AM', referenceNo: 'CR-260526-0005', reconciliationType: 'Shift 1 - Morning', reconciledBy: 'Karthik (C001)', systemCash: 9610.00, countedCash: 9610.00, variance: 0.00, variancePercent: 0.00, status: 'Exact Match', remarks: 'No variance' },
    { dateTime: '26/05/2026 02:15 PM', referenceNo: 'CR-260526-0004', reconciliationType: 'Shift 2 - Afternoon', reconciledBy: 'Karthik (C001)', systemCash: 11245.00, countedCash: 11240.00, variance: -5.00, variancePercent: -0.04, status: 'Short', remarks: 'Cash short by ₹5' },
    { dateTime: '26/05/2026 06:20 PM', referenceNo: 'CR-260526-0003', reconciliationType: 'Shift 3 - Evening', reconciledBy: 'Karthik (C001)', systemCash: 8655.00, countedCash: 8660.00, variance: 5.00, variancePercent: 0.06, status: 'Over', remarks: 'Cash over by ₹5' },
    { dateTime: '26/05/2026 10:25 PM', referenceNo: 'CR-260526-0002', reconciliationType: 'Shift 4 - Night', reconciledBy: 'Karthik (C001)', systemCash: 5070.00, countedCash: 5065.00, variance: -5.00, variancePercent: -0.10, status: 'Short', remarks: 'Cash short by ₹5' },
    { dateTime: '26/05/2026 11:55 PM', referenceNo: 'CR-260526-0001', reconciliationType: 'Shift 4 - Night', reconciledBy: 'Karthik (C001)', systemCash: 50.00, countedCash: 50.00, variance: 0.00, variancePercent: 0.00, status: 'Exact Match', remarks: 'No variance' },
  ],
};

export const SHORTAGE_EXCESS = {
  stats: {
    totalShortageExcess: { value: 3250.00, transactions: 6 },
    totalEntries: { value: 6 },
    avgAmount: { value: 541.67 },
    todaysShortageExcess: { value: 1250.00, transactions: 2 },
    selectedDateShortageExcess: { value: 3250.00, date: '26/05/2026' },
  },
  selectedDate: '26/05/2026',
  summary: {
    totalShortageExcess: 3250.00,
    totalTransactions: 6,
    recordedBy: 'Karthik (C001)',
    totalShortage: 2150.00,
    totalExcess: 1100.00,
    netAmount: 3250.00,
    shortageCount: 4,
    excessCount: 2,
    status: 'Needs Attention',
  },
  byType: [
    { id: 'shortage', label: 'Shortage', value: 2150.00, color: '#E5484D' },
    { id: 'excess', label: 'Excess', value: 1100.00, color: '#22A06B' },
  ],
  netAmountLegend: { label: 'Net Amount (Shortage - Excess)', value: 3250.00, color: '#2563EB' },
  totalPages: 1,
  transactions: [
    { dateTime: '26/05/2026 09:45 AM', referenceNo: 'SE-260526-0006', type: 'Shortage', recordedBy: 'Karthik (C001)', reason: 'Cash short in drawer', amount: 500.00, shift: 'Shift 1 - Morning', remarks: 'Cash variance' },
    { dateTime: '26/05/2026 01:15 PM', referenceNo: 'SE-260526-0005', type: 'Excess', recordedBy: 'Karthik (C001)', reason: 'Extra cash received', amount: 300.00, shift: 'Shift 1 - Morning', remarks: 'Customer over payment' },
    { dateTime: '26/05/2026 02:45 PM', referenceNo: 'SE-260526-0004', type: 'Shortage', recordedBy: 'Karthik (C001)', reason: 'Less cash in drawer', amount: 750.00, shift: 'Shift 2 - Afternoon', remarks: 'Cash variance' },
    { dateTime: '26/05/2026 06:05 PM', referenceNo: 'SE-260526-0003', type: 'Excess', recordedBy: 'Karthik (C001)', reason: 'Round off excess', amount: 800.00, shift: 'Shift 3 - Evening', remarks: 'Rounding adjustment' },
    { dateTime: '26/05/2026 09:30 PM', referenceNo: 'SE-260526-0002', recordedBy: 'Karthik (C001)', type: 'Shortage', reason: 'Cash short at closing', amount: 600.00, shift: 'Shift 4 - Night', remarks: 'End of shift variance' },
    { dateTime: '26/05/2026 10:20 PM', referenceNo: 'SE-260526-0001', type: 'Shortage', recordedBy: 'Karthik (C001)', reason: 'Small notes less', amount: 500.00, shift: 'Shift 4 - Night', remarks: 'Note denomination shortage' },
  ],
};

export const CASHIER_WISE_SALES = {
  stats: {
    totalSalesAllCashiers: { value: 98450.00, transactions: 52 },
    totalInvoices: { value: 52, quantity: 312 },
    avgInvoiceValue: { value: 1893.27 },
    todaysSales: { value: 28650.00, transactions: 14 },
    selectedDateSales: { value: 98450.00, date: '26/05/2026' },
  },
  selectedDate: '26/05/2026',
  summary: {
    totalSales: 98450.00,
    totalTransactions: 52,
    totalQuantity: 312,
    totalInvoices: 52,
    totalDiscounts: 2450.00,
    totalReturns: 1250.00,
    netSales: 96200.00,
    taxCollected: 7680.00,
  },
  byCashier: [
    { id: 'C001', label: 'Karthik (C001)', value: 46350.00, color: '#2563EB' },
    { id: 'C002', label: 'Priya (C002)', value: 28750.00, color: '#22A06B' },
    { id: 'C003', label: 'Arun (C003)', value: 15600.00, color: '#F26B21' },
    { id: 'C004', label: 'Divya (C004)', value: 7750.00, color: '#8B5CF6' },
  ],
  cashiers: [
    { code: 'C001', name: 'Karthik', totalSales: 46350.00, transactions: 24, invoices: 24, quantity: 148, avgInvoiceValue: 1931.25, discount: 1150.00, returns: 600.00, netSales: 44600.00, contributionPercent: 47.09, color: '#2563EB' },
    { code: 'C002', name: 'Priya', totalSales: 28750.00, transactions: 15, invoices: 15, quantity: 96, avgInvoiceValue: 1916.67, discount: 700.00, returns: 400.00, netSales: 27650.00, contributionPercent: 29.20, color: '#22A06B' },
    { code: 'C003', name: 'Arun', totalSales: 15600.00, transactions: 8, invoices: 8, quantity: 48, avgInvoiceValue: 1950.00, discount: 350.00, returns: 200.00, netSales: 15050.00, contributionPercent: 15.84, color: '#F26B21' },
    { code: 'C004', name: 'Divya', totalSales: 7750.00, transactions: 5, invoices: 5, quantity: 20, avgInvoiceValue: 1550.00, discount: 250.00, returns: 50.00, netSales: 7450.00, contributionPercent: 7.87, color: '#8B5CF6' },
  ],
  trend: {
    categories: ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'],
    series: [
      { code: 'C001', name: 'Karthik (C001)', color: '#2563EB', data: [0, 300, 4200, 4800, 5200, 6800, 7600, 9600, 8800, 8200, 7600, 1200] },
      { code: 'C002', name: 'Priya (C002)', color: '#22A06B', data: [0, 200, 2000, 2400, 3000, 4200, 5000, 5600, 5200, 4800, 4200, 900] },
      { code: 'C003', name: 'Arun (C003)', color: '#F26B21', data: [0, 150, 1400, 1600, 2000, 2600, 3200, 4000, 3600, 3400, 3000, 600] },
      { code: 'C004', name: 'Divya (C004)', color: '#8B5CF6', data: [0, 100, 900, 1100, 1400, 1800, 2200, 2600, 2400, 2200, 2000, 400] },
    ],
  },
  topPerformers: [
    { rank: 1, code: 'C001', name: 'Karthik', label: 'Karthik (C001)', value: 46350.00 },
    { rank: 2, code: 'C002', name: 'Priya', label: 'Priya (C002)', value: 28750.00 },
    { rank: 3, code: 'C003', name: 'Arun', label: 'Arun (C003)', value: 15600.00 },
  ],
  totalPages: 1,
};

export const CASH_TRANSFER = {
  stats: {
    totalCashTransfer: { value: 6250.00, transactions: 10 },
    totalTransfers: { value: 10 },
    avgTransferValue: { value: 625.00 },
    todaysCashTransfer: { value: 6250.00, transactions: 10 },
    selectedDateTransfer: { value: 6250.00, date: '26/05/2026' },
  },
  selectedDate: '26/05/2026',
  summary: {
    totalCashTransfer: 6250.00,
    totalTransactions: 10,
    totalTransferredBy: 'Karthik (C001)',
    openingCash: 25000.00,
    totalSalesAllModes: 32405.00,
    closingCashActual: 19845.00,
  },
  byPurpose: [
    { id: 'bank-deposit', label: 'Bank Deposit', value: 3000.00, color: '#22A06B' },
    { id: 'petty-cash', label: 'Petty Cash', value: 1250.00, color: '#F5A623' },
    { id: 'change-fund', label: 'Change Fund', value: 1000.00, color: '#2563EB' },
    { id: 'other-purpose', label: 'Other Purpose', value: 1000.00, color: '#8B5CF6' },
  ],
  totalPages: 3,
  transactions: [
    { dateTime: '26/05/2026 04:25 PM', referenceNo: 'CT-260526-0010', from: 'Cash Counter', to: 'HDFC Bank - A/c 1234567890', purpose: 'Bank Deposit', transferredBy: 'Karthik (C001)', amount: 3000.00, paymentMode: 'Cash', remarks: 'Daily sales deposit' },
    { dateTime: '26/05/2026 03:40 PM', referenceNo: 'CT-260526-0009', from: 'Cash Counter', to: 'Petty Cash Box', purpose: 'Petty Cash', transferredBy: 'Karthik (C001)', amount: 1250.00, paymentMode: 'Cash', remarks: 'For petty expenses' },
    { dateTime: '26/05/2026 02:50 PM', referenceNo: 'CT-260526-0008', from: 'Cash Counter', to: 'Change Fund Box', purpose: 'Change Fund', transferredBy: 'Karthik (C001)', amount: 1000.00, paymentMode: 'Cash', remarks: 'Change fund for sales' },
    { dateTime: '26/05/2026 01:20 PM', referenceNo: 'CT-260526-0007', from: 'Cash Counter', to: 'Office Cash', purpose: 'Other Purpose', transferredBy: 'Karthik (C001)', amount: 500.00, paymentMode: 'Cash', remarks: 'Office expense advance' },
    { dateTime: '26/05/2026 11:45 AM', referenceNo: 'CT-260526-0006', from: 'Cash Counter', to: 'Staff Refreshment Fund', purpose: 'Other Purpose', transferredBy: 'Karthik (C001)', amount: 500.00, paymentMode: 'Cash', remarks: 'Staff refreshment' },
  ],
};
