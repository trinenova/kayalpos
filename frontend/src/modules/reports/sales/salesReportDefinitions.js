import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import PercentOutlinedIcon from '@mui/icons-material/PercentOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';

import {
  useHourlySalesReportQuery, useHourlySalesItemsQuery, usePaymentWiseSalesReportQuery, useDiscountReportQuery, useTaxReportQuery, useReturnReportQuery,
  salesReportsEndpoints,
} from '../../../api/salesReportsApi';

const money = (v) => (v === null || v === undefined ? '—' : `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const qty = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('en-IN'));
const dateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const dateOnly = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/**
 * One definition per Sales Report card that opens a real report (Hourly
 * Sales, Payment-wise Sales, Discount Report, Tax Report, Return Report) —
 * see SalesReportsPage.jsx's SALES_REPORT_ITEMS. Consumed by
 * SalesReportDetailPage.jsx the same way InventoryReportDetailPage.jsx /
 * CashierReportDetailPage.jsx consume their own definitions maps.
 */
export const SALES_REPORT_DEFINITIONS = {
  'hourly-sales': {
    label: 'Hourly Sales',
    description: 'Sales totals by hour of day — see when sales actually happen.',
    icon: AccessTimeOutlinedIcon,
    useQuery: useHourlySalesReportQuery,
    endpoint: salesReportsEndpoints.HourlySalesReport,
    defaultRangeDays: 7,
    columns: [
      { key: 'hourLabel', label: 'Hour' },
      { key: 'transactions', label: 'Transactions', align: 'right', render: (r) => qty(r.transactions) },
      { key: 'quantity', label: 'Qty Sold', align: 'right', render: (r) => qty(r.quantity) },
      { key: 'totalSales', label: 'Total Sales', align: 'right', render: (r) => money(r.totalSales) },
      { key: 'avgBillValue', label: 'Avg. Bill Value', align: 'right', render: (r) => money(r.avgBillValue) },
    ],
    exportName: 'hourly-sales',
    exportHeaders: ['Hour', 'Transactions', 'Qty Sold', 'Total Sales', 'Avg. Bill Value'],
    exportRow: (r) => [r.hourLabel, r.transactions, r.quantity, r.totalSales, r.avgBillValue],
    // Click a row to see which items were actually sold in that hour.
    drillDown: {
      title: (row) => `Items sold — ${row.hourLabel}`,
      useQuery: useHourlySalesItemsQuery,
      buildParams: (row, baseParams) => ({
        hour: row.id, from: baseParams.from, to: baseParams.to, outletId: baseParams.outletId,
      }),
      columns: [
        { key: 'itemCode', label: 'Item Code' },
        { key: 'itemName', label: 'Item Name' },
        { key: 'qty', label: 'Qty Sold', align: 'right', render: (r) => qty(r.qty) },
        { key: 'salesValue', label: 'Sales Value', align: 'right', render: (r) => money(r.salesValue) },
      ],
      emptyMessage: 'No items were sold in this hour for the selected filters.',
    },
    summaryTiles: (s) => [
      { icon: ReceiptLongOutlinedIcon, iconColor: '#2563EB', label: 'Transactions', value: qty(s.totalTransactions) },
      { icon: PaidOutlinedIcon, iconColor: '#22A06B', label: 'Total sales', value: money(s.totalSales) },
      { icon: TrendingUpOutlinedIcon, iconColor: '#F26B21', label: 'Peak hour', value: s.peakHour },
      { icon: PaidOutlinedIcon, iconColor: '#F5A623', label: 'Peak hour sales', value: money(s.peakHourSales) },
    ],
  },
  'payment-wise-sales': {
    label: 'Payment-wise Sales',
    description: 'Sales totals by payment mode (Cash, Card, UPI, …).',
    icon: CreditCardOutlinedIcon,
    useQuery: usePaymentWiseSalesReportQuery,
    endpoint: salesReportsEndpoints.PaymentWiseSalesReport,
    columns: [
      { key: 'paymentMode', label: 'Payment Mode' },
      { key: 'transactions', label: 'Transactions', align: 'right', render: (r) => qty(r.transactions) },
      { key: 'totalSales', label: 'Total Sales', align: 'right', render: (r) => money(r.totalSales) },
      { key: 'contributionPercent', label: 'Contribution %', align: 'right', render: (r) => `${r.contributionPercent}%` },
      { key: 'avgBillValue', label: 'Avg. Bill Value', align: 'right', render: (r) => money(r.avgBillValue) },
    ],
    exportName: 'payment-wise-sales',
    exportHeaders: ['Payment Mode', 'Transactions', 'Total Sales', 'Contribution %', 'Avg. Bill Value'],
    exportRow: (r) => [r.paymentMode, r.transactions, r.totalSales, r.contributionPercent, r.avgBillValue],
    summaryTiles: (s) => [
      { icon: CreditCardOutlinedIcon, iconColor: '#7C3AED', label: 'Payment modes', value: String(s.paymentModes) },
      { icon: ReceiptLongOutlinedIcon, iconColor: '#2563EB', label: 'Transactions', value: qty(s.totalTransactions) },
      { icon: PaidOutlinedIcon, iconColor: '#22A06B', label: 'Total sales', value: money(s.totalSales) },
    ],
  },
  'discount-report': {
    label: 'Discount Report',
    description: 'Bills with a real discount applied, and how much was given away.',
    icon: PercentOutlinedIcon,
    useQuery: useDiscountReportQuery,
    endpoint: salesReportsEndpoints.DiscountReport,
    columns: [
      { key: 'billNo', label: 'Bill No.' },
      { key: 'date', label: 'Date', render: (r) => dateTime(r.date) },
      { key: 'cashierName', label: 'Cashier' },
      { key: 'customerName', label: 'Customer' },
      { key: 'subTotal', label: 'Sub Total', align: 'right', render: (r) => money(r.subTotal) },
      { key: 'discountAmount', label: 'Discount', align: 'right', render: (r) => money(r.discountAmount) },
      { key: 'discountPercent', label: 'Discount %', align: 'right', render: (r) => `${r.discountPercent}%` },
      { key: 'grandTotal', label: 'Grand Total', align: 'right', render: (r) => money(r.grandTotal) },
    ],
    exportName: 'discount-report',
    exportHeaders: ['Bill No.', 'Date', 'Cashier', 'Customer', 'Sub Total', 'Discount', 'Discount %', 'Grand Total'],
    exportRow: (r) => [r.billNo, dateTime(r.date), r.cashierName, r.customerName, r.subTotal, r.discountAmount, r.discountPercent, r.grandTotal],
    summaryTiles: (s) => [
      { icon: ReceiptLongOutlinedIcon, iconColor: '#2563EB', label: 'Discounted bills', value: String(s.totalBills) },
      { icon: PercentOutlinedIcon, iconColor: '#F5A623', label: 'Total discount', value: money(s.totalDiscount) },
      { icon: PercentOutlinedIcon, iconColor: '#E5484D', label: 'Avg. discount %', value: `${s.avgDiscountPercent}%` },
    ],
  },
  'tax-report': {
    label: 'Tax Report',
    description: 'Tax collected, grouped by tax code applied on each item line.',
    icon: ReceiptOutlinedIcon,
    useQuery: useTaxReportQuery,
    endpoint: salesReportsEndpoints.TaxReport,
    columns: [
      { key: 'taxCode', label: 'Tax Code' },
      { key: 'taxableValue', label: 'Taxable Value', align: 'right', render: (r) => money(r.taxableValue) },
      { key: 'taxCollected', label: 'Tax Collected', align: 'right', render: (r) => money(r.taxCollected) },
      { key: 'effectiveRate', label: 'Effective Rate', align: 'right', render: (r) => `${r.effectiveRate}%` },
      { key: 'netSales', label: 'Net Sales', align: 'right', render: (r) => money(r.netSales) },
    ],
    exportName: 'tax-report',
    exportHeaders: ['Tax Code', 'Taxable Value', 'Tax Collected', 'Effective Rate', 'Net Sales'],
    exportRow: (r) => [r.taxCode, r.taxableValue, r.taxCollected, r.effectiveRate, r.netSales],
    summaryTiles: (s) => [
      { icon: ReceiptOutlinedIcon, iconColor: '#2563EB', label: 'Tax codes', value: String(s.taxCodes) },
      { icon: PaidOutlinedIcon, iconColor: '#22A06B', label: 'Taxable value', value: money(s.totalTaxableValue) },
      { icon: PaidOutlinedIcon, iconColor: '#F5A623', label: 'Tax collected', value: money(s.totalTaxCollected) },
    ],
  },
  'return-report': {
    label: 'Return Report',
    description: 'Sales returns and refunds against original bills.',
    icon: KeyboardReturnOutlinedIcon,
    useQuery: useReturnReportQuery,
    endpoint: salesReportsEndpoints.ReturnReport,
    columns: [
      { key: 'returnNo', label: 'Return No.' },
      { key: 'date', label: 'Date', render: (r) => dateOnly(r.date) },
      { key: 'originalBillNo', label: 'Original Bill' },
      { key: 'customerName', label: 'Customer' },
      { key: 'cashierName', label: 'Cashier' },
      { key: 'reason', label: 'Reason' },
      { key: 'refundMode', label: 'Refund Mode' },
      { key: 'refundTo', label: 'Refund To' },
      { key: 'grandTotal', label: 'Refund Amount', align: 'right', render: (r) => money(r.grandTotal) },
    ],
    exportName: 'return-report',
    exportHeaders: ['Return No.', 'Date', 'Original Bill', 'Customer', 'Cashier', 'Reason', 'Refund Mode', 'Refund To', 'Refund Amount'],
    exportRow: (r) => [r.returnNo, dateOnly(r.date), r.originalBillNo, r.customerName, r.cashierName, r.reason, r.refundMode, r.refundTo, r.grandTotal],
    summaryTiles: (s) => [
      { icon: KeyboardReturnOutlinedIcon, iconColor: '#E5484D', label: 'Returns', value: String(s.totalReturns) },
      { icon: PaidOutlinedIcon, iconColor: '#F5A623', label: 'Total refund amount', value: money(s.totalRefundAmount) },
      { icon: PaidOutlinedIcon, iconColor: '#7C3AED', label: 'Avg. return value', value: money(s.avgReturnValue) },
    ],
  },
};
