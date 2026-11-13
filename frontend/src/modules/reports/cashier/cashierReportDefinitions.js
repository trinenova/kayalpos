import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import TrendingDownOutlinedIcon from '@mui/icons-material/TrendingDownOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined';

import {
  useCashierSalesReportQuery, usePaymentCollectionReportQuery, useCashShortageExcessReportQuery, cashierReportsEndpoints,
} from '../../../api/cashierReportsApi';

const money = (v) => (v === null || v === undefined ? '—' : `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const qty = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('en-IN'));
const dateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

const VARIANCE_TYPE_LABEL = { SHORTAGE: ['Shortage', 'error'], EXCESS: ['Excess', 'warning'] };

/**
 * One definition per Cashier Report card that opens a real report (Cashier
 * Sales, Cash Collection, Cash Shortage/Excess) — see
 * CashierReportsPage.jsx's CASHIER_REPORT_ITEMS. Every one of these shares
 * the same filter bar (date range + outlet + cashier + search), unlike the
 * Inventory Reports (which needed different filters per report), so
 * CashierReportDetailPage.jsx renders that bar directly instead of reading
 * a `filters` list from here.
 */
export const CASHIER_REPORT_DEFINITIONS = {
  'cashier-sales': {
    label: 'Cashier Sales',
    description: 'Sales summary per cashier — totals, quantity, discounts, returns and net sales.',
    useQuery: useCashierSalesReportQuery,
    endpoint: cashierReportsEndpoints.CashierSalesReport,
    columns: [
      { key: 'cashierName', label: 'Cashier' },
      { key: 'transactions', label: 'Invoices', align: 'right', render: (r) => qty(r.transactions) },
      { key: 'quantity', label: 'Qty Sold', align: 'right', render: (r) => qty(r.quantity) },
      { key: 'totalSales', label: 'Total Sales', align: 'right', render: (r) => money(r.totalSales) },
      { key: 'discount', label: 'Discount', align: 'right', render: (r) => money(r.discount) },
      { key: 'returns', label: 'Returns', align: 'right', render: (r) => money(r.returns) },
      { key: 'netSales', label: 'Net Sales', align: 'right', render: (r) => money(r.netSales) },
      { key: 'avgInvoiceValue', label: 'Avg. Invoice', align: 'right', render: (r) => money(r.avgInvoiceValue) },
    ],
    exportName: 'cashier-sales',
    exportHeaders: ['Cashier', 'Invoices', 'Qty Sold', 'Total Sales', 'Discount', 'Returns', 'Net Sales', 'Avg. Invoice'],
    exportRow: (r) => [r.cashierName, r.transactions, r.quantity, r.totalSales, r.discount, r.returns, r.netSales, r.avgInvoiceValue],
    summaryTiles: (s) => [
      { icon: PersonOutlineOutlinedIcon, iconColor: '#2563EB', label: 'Cashiers', value: String(s.totalCashiers) },
      { icon: ReceiptLongOutlinedIcon, iconColor: '#0EA5A4', label: 'Transactions', value: qty(s.totalTransactions) },
      { icon: PaidOutlinedIcon, iconColor: '#22A06B', label: 'Total sales', value: money(s.totalSales) },
      { icon: PaidOutlinedIcon, iconColor: '#F5A623', label: 'Net sales', value: money(s.netSales) },
    ],
  },
  'payment-collection': {
    label: 'Payment Collection',
    description: 'Amount collected per cashier, split by Cash, UPI and Card.',
    useQuery: usePaymentCollectionReportQuery,
    endpoint: cashierReportsEndpoints.PaymentCollectionReport,
    columns: [
      { key: 'cashierName', label: 'Cashier' },
      { key: 'transactions', label: 'Transactions', align: 'right', render: (r) => qty(r.transactions) },
      { key: 'cashCollected', label: 'Cash', align: 'right', render: (r) => money(r.cashCollected) },
      { key: 'upiCollected', label: 'UPI', align: 'right', render: (r) => money(r.upiCollected) },
      { key: 'cardCollected', label: 'Card', align: 'right', render: (r) => money(r.cardCollected) },
      { key: 'totalCollected', label: 'Total Collected', align: 'right', render: (r) => money(r.totalCollected) },
      { key: 'totalRefunds', label: 'Refunds', align: 'right', render: (r) => money(r.totalRefunds) },
      { key: 'netCollected', label: 'Net Collected', align: 'right', render: (r) => money(r.netCollected) },
    ],
    exportName: 'payment-collection',
    exportHeaders: ['Cashier', 'Transactions', 'Cash', 'UPI', 'Card', 'Total Collected', 'Refunds', 'Net Collected'],
    exportRow: (r) => [r.cashierName, r.transactions, r.cashCollected, r.upiCollected, r.cardCollected, r.totalCollected, r.totalRefunds, r.netCollected],
    summaryTiles: (s) => [
      { icon: PersonOutlineOutlinedIcon, iconColor: '#2563EB', label: 'Cashiers', value: String(s.totalCashiers) },
      { icon: PaidOutlinedIcon, iconColor: '#22A06B', label: 'Cash collected', value: money(s.totalCash) },
      { icon: PaidOutlinedIcon, iconColor: '#0EA5A4', label: 'UPI collected', value: money(s.totalUpi) },
      { icon: PaidOutlinedIcon, iconColor: '#7C3AED', label: 'Card collected', value: money(s.totalCard) },
      { icon: PaidOutlinedIcon, iconColor: '#F5A623', label: 'Net collected', value: money(s.netCollected) },
    ],
  },
  'cash-shortage-excess': {
    label: 'Cash Shortage / Excess',
    description: 'Closed shifts with a real cash variance — counted closing cash vs. expected.',
    useQuery: useCashShortageExcessReportQuery,
    endpoint: cashierReportsEndpoints.CashShortageExcessReport,
    columns: [
      { key: 'shiftNo', label: 'Shift No.' },
      { key: 'cashierName', label: 'Cashier' },
      { key: 'outletName', label: 'Outlet' },
      { key: 'closedAt', label: 'Closed', render: (r) => dateTime(r.closedAt) },
      { key: 'type', label: 'Type', chip: VARIANCE_TYPE_LABEL },
      {
        key: 'amount', label: 'Amount', align: 'right', render: (r) => money(r.amount), color: (r) => (r.type === 'SHORTAGE' ? 'error.main' : 'warning.dark'),
      },
      { key: 'expectedClosingCash', label: 'Expected Closing', align: 'right', render: (r) => money(r.expectedClosingCash) },
      { key: 'actualClosingCash', label: 'Actual Closing', align: 'right', render: (r) => money(r.actualClosingCash) },
      { key: 'remarks', label: 'Remarks' },
    ],
    exportName: 'cash-shortage-excess',
    exportHeaders: ['Shift No.', 'Cashier', 'Outlet', 'Closed', 'Type', 'Amount', 'Expected Closing', 'Actual Closing', 'Remarks'],
    exportRow: (r) => [r.shiftNo, r.cashierName, r.outletName, dateTime(r.closedAt), r.type, r.amount, r.expectedClosingCash ?? '', r.actualClosingCash ?? '', r.remarks],
    summaryTiles: (s) => [
      { icon: BalanceOutlinedIcon, iconColor: '#7C3AED', label: 'Variance entries', value: String(s.totalEntries) },
      { icon: TrendingDownOutlinedIcon, iconColor: '#E5484D', label: 'Total shortage', value: money(s.totalShortage) },
      { icon: TrendingUpOutlinedIcon, iconColor: '#F5A623', label: 'Total excess', value: money(s.totalExcess) },
      { icon: BalanceOutlinedIcon, iconColor: '#6B7280', label: 'Net amount', value: money(s.netAmount) },
    ],
  },
};
