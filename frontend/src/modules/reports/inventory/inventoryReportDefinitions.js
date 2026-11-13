import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import TrendingDownOutlinedIcon from '@mui/icons-material/TrendingDownOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import CurrencyRupeeOutlinedIcon from '@mui/icons-material/CurrencyRupeeOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';

import {
  useCurrentStockReportQuery, useLowStockReportQuery, useOutOfStockReportQuery, useStockValuationReportQuery,
  useBatchExpiryReportQuery, useWastageReportQuery, useStockAdjustmentReportQuery, usePhysicalStockVarianceReportQuery,
  useSlowMovingItemsReportQuery, useFastMovingItemsReportQuery, useStockMovementReportQuery,
  inventoryReportsEndpoints,
} from '../../../api/inventoryReportsApi';

const money = (v) => (v === null || v === undefined ? '—' : `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const qty = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('en-IN'));
const dateOnly = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const STOCK_STATUS_LABEL = {
  IN_STOCK: ['In Stock', 'success'], LOW_STOCK: ['Low Stock', 'warning'], OUT_OF_STOCK: ['Out of Stock', 'error'],
};
const EXPIRY_STATUS_LABEL = {
  EXPIRED: ['Expired', 'error'], EXPIRING_SOON: ['Expiring soon', 'warning'], ACTIVE: ['Active', 'success'], NO_EXPIRY: ['No expiry', 'default'],
};

// Shared column set for Current Stock / Low Stock / Out-of-Stock / Stock
// Valuation — all four read the same Product snapshot, just a different
// bucket/sort (see inventoryReports.service.js's stockLevelReport).
const STOCK_LEVEL_COLUMNS = [
  { key: 'code', label: 'Item Code' },
  { key: 'name', label: 'Item Name' },
  { key: 'group', label: 'Group' },
  { key: 'brand', label: 'Brand' },
  { key: 'uom', label: 'UOM' },
  { key: 'availableQty', label: 'Available Qty', align: 'right', render: (r) => qty(r.availableQty) },
  { key: 'reorderLevel', label: 'Reorder Level', align: 'right', render: (r) => qty(r.reorderLevel) },
  { key: 'salePrice', label: 'Sale Price', align: 'right', render: (r) => money(r.salePrice) },
  { key: 'stockValue', label: 'Stock Value', align: 'right', render: (r) => money(r.stockValue) },
  { key: 'status', label: 'Status', chip: STOCK_STATUS_LABEL },
];
const STOCK_LEVEL_EXPORT = {
  headers: ['Item Code', 'Item Name', 'Group', 'Brand', 'UOM', 'Available Qty', 'Reorder Level', 'Sale Price', 'Stock Value', 'Status'],
  row: (r) => [r.code, r.name, r.group, r.brand, r.uom, r.availableQty, r.reorderLevel, r.salePrice, r.stockValue, r.status],
};

const COUNT_VARIANCE_COLUMNS = [
  { key: 'countCode', label: 'Count No.' },
  { key: 'countDate', label: 'Count Date', render: (r) => dateOnly(r.countDate) },
  { key: 'warehouse', label: 'Warehouse' },
  { key: 'itemCode', label: 'Item Code' },
  { key: 'itemName', label: 'Item Name' },
  { key: 'systemQty', label: 'System Qty', align: 'right', render: (r) => qty(r.systemQty) },
  { key: 'countedQty', label: 'Counted Qty', align: 'right', render: (r) => qty(r.countedQty) },
  {
    key: 'varianceQty', label: 'Variance Qty', align: 'right', render: (r) => qty(r.varianceQty), color: (r) => (r.varianceQty < 0 ? 'error.main' : 'warning.dark'),
  },
  {
    key: 'varianceValue', label: 'Variance Value', align: 'right', render: (r) => money(r.varianceValue), color: (r) => (r.varianceQty < 0 ? 'error.main' : 'warning.dark'),
  },
  { key: 'status', label: 'Status' },
];
const COUNT_VARIANCE_EXPORT = {
  headers: ['Count No.', 'Count Date', 'Warehouse', 'Item Code', 'Item Name', 'System Qty', 'Counted Qty', 'Variance Qty', 'Variance Value', 'Status'],
  row: (r) => [r.countCode, dateOnly(r.countDate), r.warehouse, r.itemCode, r.itemName, r.systemQty, r.countedQty, r.varianceQty, r.varianceValue, r.status],
};

const MOVEMENT_RANKING_COLUMNS = [
  { key: 'code', label: 'Item Code' },
  { key: 'name', label: 'Item Name' },
  { key: 'uom', label: 'UOM' },
  { key: 'availableQty', label: 'Current Stock', align: 'right', render: (r) => qty(r.availableQty) },
  { key: 'qtySold', label: 'Qty Sold', align: 'right', render: (r) => qty(r.qtySold) },
  { key: 'salesValue', label: 'Sales Value', align: 'right', render: (r) => money(r.salesValue) },
];
const MOVEMENT_RANKING_EXPORT = {
  headers: ['Item Code', 'Item Name', 'UOM', 'Current Stock', 'Qty Sold', 'Sales Value'],
  row: (r) => [r.code, r.name, r.uom, r.availableQty, r.qtySold, r.salesValue],
};

/**
 * One definition per Inventory Report card (Reports > Inventory Reports).
 * `useQuery`/`endpoint` point at the matching inventoryReportsApi hook —
 * see inventoryReportsApi.js / inventoryReports.service.js for what each
 * actually computes. `filters` lists which filter controls
 * InventoryReportDetailPage.jsx should render for this report; `search` is
 * implicit on every report.
 */
export const INVENTORY_REPORT_DEFINITIONS = {
  'current-stock': {
    label: 'Current Stock',
    description: 'Current on-hand quantity and value for every active item.',
    icon: Inventory2OutlinedIcon,
    color: '#2563EB',
    useQuery: useCurrentStockReportQuery,
    endpoint: inventoryReportsEndpoints.CurrentStockReport,
    filters: [],
    columns: STOCK_LEVEL_COLUMNS,
    exportName: 'current-stock',
    exportHeaders: STOCK_LEVEL_EXPORT.headers,
    exportRow: STOCK_LEVEL_EXPORT.row,
    summaryTiles: (s) => [
      { icon: Inventory2OutlinedIcon, iconColor: '#2563EB', label: 'Total items', value: String(s.totalItems) },
      { icon: SwapHorizOutlinedIcon, iconColor: '#0EA5A4', label: 'Total quantity', value: qty(s.totalQty) },
      { icon: CurrencyRupeeOutlinedIcon, iconColor: '#22A06B', label: 'Total stock value', value: money(s.totalValue) },
    ],
  },
  'low-stock': {
    label: 'Low Stock',
    description: 'Active items at or below their reorder level.',
    icon: TrendingDownOutlinedIcon,
    color: '#22A06B',
    useQuery: useLowStockReportQuery,
    endpoint: inventoryReportsEndpoints.LowStockReport,
    filters: [],
    columns: STOCK_LEVEL_COLUMNS,
    exportName: 'low-stock',
    exportHeaders: STOCK_LEVEL_EXPORT.headers,
    exportRow: STOCK_LEVEL_EXPORT.row,
    summaryTiles: (s) => [
      { icon: TrendingDownOutlinedIcon, iconColor: '#22A06B', label: 'Low stock items', value: String(s.totalItems) },
      { icon: SwapHorizOutlinedIcon, iconColor: '#0EA5A4', label: 'Total quantity', value: qty(s.totalQty) },
      { icon: CurrencyRupeeOutlinedIcon, iconColor: '#F5A623', label: 'Stock value at risk', value: money(s.totalValue) },
    ],
  },
  'out-of-stock': {
    label: 'Out-of-Stock',
    description: 'Active items with zero or negative available quantity.',
    icon: Inventory2OutlinedIcon,
    color: '#F26B21',
    useQuery: useOutOfStockReportQuery,
    endpoint: inventoryReportsEndpoints.OutOfStockReport,
    filters: [],
    columns: STOCK_LEVEL_COLUMNS,
    exportName: 'out-of-stock',
    exportHeaders: STOCK_LEVEL_EXPORT.headers,
    exportRow: STOCK_LEVEL_EXPORT.row,
    summaryTiles: (s) => [
      { icon: Inventory2OutlinedIcon, iconColor: '#F26B21', label: 'Out-of-stock items', value: String(s.totalItems) },
      { icon: CurrencyRupeeOutlinedIcon, iconColor: '#7C3AED', label: 'Lost potential value', value: money(s.totalValue) },
    ],
  },
  'stock-valuation': {
    label: 'Stock Valuation',
    description: 'Inventory value on hand, at current sale price, by item.',
    icon: CurrencyRupeeOutlinedIcon,
    color: '#0EA5A4',
    useQuery: useStockValuationReportQuery,
    endpoint: inventoryReportsEndpoints.StockValuationReport,
    filters: [],
    columns: STOCK_LEVEL_COLUMNS,
    exportName: 'stock-valuation',
    exportHeaders: STOCK_LEVEL_EXPORT.headers,
    exportRow: STOCK_LEVEL_EXPORT.row,
    summaryTiles: (s) => [
      { icon: Inventory2OutlinedIcon, iconColor: '#2563EB', label: 'Total items', value: String(s.totalItems) },
      { icon: SwapHorizOutlinedIcon, iconColor: '#0EA5A4', label: 'Total quantity', value: qty(s.totalQty) },
      { icon: CurrencyRupeeOutlinedIcon, iconColor: '#22A06B', label: 'Total stock value', value: money(s.totalValue) },
    ],
  },
  'stock-movement': {
    label: 'Stock Movement',
    description: 'Every stock-affecting event in the period: receipts, sales, wastage and returns.',
    icon: SwapHorizOutlinedIcon,
    color: '#7C3AED',
    useQuery: useStockMovementReportQuery,
    endpoint: inventoryReportsEndpoints.StockMovementReport,
    filters: ['dateRange', 'type'],
    defaultRangeDays: 7,
    typeOptions: [
      { value: 'all', label: 'All movements' },
      { value: 'in', label: 'Stock in' },
      { value: 'out', label: 'Stock out' },
    ],
    columns: [
      { key: 'date', label: 'Date', render: (r) => dateOnly(r.date) },
      { key: 'type', label: 'Type', chip: { IN: ['In', 'success'], OUT: ['Out', 'error'] } },
      { key: 'source', label: 'Source' },
      { key: 'reference', label: 'Reference' },
      { key: 'itemCode', label: 'Item Code' },
      { key: 'itemName', label: 'Item Name' },
      {
        key: 'qty', label: 'Qty', align: 'right', render: (r) => qty(r.qty), color: (r) => (r.qty < 0 ? 'error.main' : 'success.main'),
      },
      {
        key: 'value', label: 'Value', align: 'right', render: (r) => money(r.value), color: (r) => (r.value < 0 ? 'error.main' : 'success.main'),
      },
      { key: 'party', label: 'Party', render: (r) => r.party || '—' },
    ],
    exportName: 'stock-movement',
    exportHeaders: ['Date', 'Type', 'Source', 'Reference', 'Item Code', 'Item Name', 'Qty', 'Value', 'Party'],
    exportRow: (r) => [dateOnly(r.date), r.type, r.source, r.reference, r.itemCode, r.itemName, r.qty, r.value, r.party || ''],
    summaryTiles: (s) => [
      { icon: TrendingUpOutlinedIcon, iconColor: '#22A06B', label: 'Total stock in', value: qty(s.totalIn) },
      { icon: TrendingDownOutlinedIcon, iconColor: '#E5484D', label: 'Total stock out', value: qty(s.totalOut) },
      { icon: CurrencyRupeeOutlinedIcon, iconColor: '#7C3AED', label: 'Net movement value', value: money(s.netValue) },
    ],
  },
  'stock-adjustment': {
    label: 'Stock Adjustment',
    description: 'Finalized physical-count adjustments (completed stock counts) by item.',
    icon: TuneOutlinedIcon,
    color: '#E5484D',
    useQuery: useStockAdjustmentReportQuery,
    endpoint: inventoryReportsEndpoints.StockAdjustmentReport,
    filters: ['dateRange', 'warehouseName'],
    defaultRangeDays: 30,
    columns: COUNT_VARIANCE_COLUMNS,
    exportName: 'stock-adjustment',
    exportHeaders: COUNT_VARIANCE_EXPORT.headers,
    exportRow: COUNT_VARIANCE_EXPORT.row,
    summaryTiles: (s) => [
      { icon: TuneOutlinedIcon, iconColor: '#E5484D', label: 'Adjusted lines', value: String(s.totalRecords) },
      { icon: TrendingDownOutlinedIcon, iconColor: '#E5484D', label: 'Shortage value', value: money(s.shortageValue) },
      { icon: TrendingUpOutlinedIcon, iconColor: '#F5A623', label: 'Excess value', value: money(s.excessValue) },
    ],
  },
  wastage: {
    label: 'Wastage',
    description: 'Items written off as wastage — expired, damaged or spoiled stock.',
    icon: DeleteOutlineOutlinedIcon,
    color: '#F5A623',
    useQuery: useWastageReportQuery,
    endpoint: inventoryReportsEndpoints.WastageReport,
    filters: ['dateRange', 'outlet'],
    defaultRangeDays: 30,
    columns: [
      { key: 'wastageCode', label: 'Wastage No.' },
      { key: 'wastageDate', label: 'Date', render: (r) => dateOnly(r.wastageDate) },
      { key: 'outletName', label: 'Outlet' },
      { key: 'wastageType', label: 'Type' },
      { key: 'itemCode', label: 'Item Code' },
      { key: 'itemName', label: 'Item Name' },
      { key: 'qty', label: 'Qty', align: 'right', render: (r) => qty(r.qty) },
      { key: 'unitCost', label: 'Unit Cost', align: 'right', render: (r) => money(r.unitCost) },
      { key: 'totalValue', label: 'Total Value', align: 'right', render: (r) => money(r.totalValue) },
      { key: 'status', label: 'Status' },
    ],
    exportName: 'wastage',
    exportHeaders: ['Wastage No.', 'Date', 'Outlet', 'Type', 'Item Code', 'Item Name', 'Qty', 'Unit Cost', 'Total Value', 'Status'],
    exportRow: (r) => [r.wastageCode, dateOnly(r.wastageDate), r.outletName, r.wastageType, r.itemCode, r.itemName, r.qty, r.unitCost, r.totalValue, r.status],
    summaryTiles: (s) => [
      { icon: DeleteOutlineOutlinedIcon, iconColor: '#F5A623', label: 'Wastage records', value: String(s.totalRecords) },
      { icon: SwapHorizOutlinedIcon, iconColor: '#7C3AED', label: 'Total qty wasted', value: qty(s.totalQty) },
      { icon: CurrencyRupeeOutlinedIcon, iconColor: '#E5484D', label: 'Total value wasted', value: money(s.totalValue) },
    ],
  },
  'batch-expiry': {
    label: 'Batch Expiry',
    description: 'Batch/serial stock by expiry date — expired, expiring soon and active.',
    icon: EventAvailableOutlinedIcon,
    color: '#22A06B',
    useQuery: useBatchExpiryReportQuery,
    endpoint: inventoryReportsEndpoints.BatchExpiryReport,
    filters: ['warehouseId', 'expiryStatus'],
    columns: [
      { key: 'batchNo', label: 'Batch/Serial No.' },
      { key: 'type', label: 'Type' },
      { key: 'productCode', label: 'Item Code' },
      { key: 'productName', label: 'Item Name' },
      { key: 'warehouse', label: 'Warehouse' },
      { key: 'mfgDate', label: 'Mfg Date', render: (r) => dateOnly(r.mfgDate) },
      { key: 'expiryDate', label: 'Expiry Date', render: (r) => dateOnly(r.expiryDate) },
      { key: 'qty', label: 'Qty', align: 'right', render: (r) => qty(r.qty) },
      { key: 'uom', label: 'UOM' },
      { key: 'expiryStatus', label: 'Status', chip: EXPIRY_STATUS_LABEL },
    ],
    exportName: 'batch-expiry',
    exportHeaders: ['Batch/Serial No.', 'Type', 'Item Code', 'Item Name', 'Warehouse', 'Mfg Date', 'Expiry Date', 'Qty', 'UOM', 'Status'],
    exportRow: (r) => [r.batchNo, r.type, r.productCode, r.productName, r.warehouse, dateOnly(r.mfgDate), dateOnly(r.expiryDate), r.qty, r.uom, r.expiryStatus],
    summaryTiles: (s) => [
      { icon: EventAvailableOutlinedIcon, iconColor: '#22A06B', label: 'Total batches', value: String(s.totalBatches) },
      { icon: ReportProblemOutlinedIcon, iconColor: '#E5484D', label: 'Expired', value: String(s.expired) },
      { icon: HourglassEmptyOutlinedIcon, iconColor: '#F5A623', label: 'Expiring within 30 days', value: String(s.expiringSoon) },
    ],
  },
  'slow-moving-items': {
    label: 'Slow Moving Items',
    description: 'Items with the lowest sales quantity in the period — oldest stock risk first.',
    icon: HourglassEmptyOutlinedIcon,
    color: '#7C3AED',
    useQuery: useSlowMovingItemsReportQuery,
    endpoint: inventoryReportsEndpoints.SlowMovingItemsReport,
    filters: ['dateRange'],
    defaultRangeDays: 30,
    columns: MOVEMENT_RANKING_COLUMNS,
    exportName: 'slow-moving-items',
    exportHeaders: MOVEMENT_RANKING_EXPORT.headers,
    exportRow: MOVEMENT_RANKING_EXPORT.row,
    summaryTiles: (s) => [
      { icon: HourglassEmptyOutlinedIcon, iconColor: '#7C3AED', label: 'Days in range', value: String(s.rangeDays) },
      { icon: ReportProblemOutlinedIcon, iconColor: '#E5484D', label: 'Items with zero sales', value: String(s.zeroSaleItems) },
    ],
  },
  'fast-moving-items': {
    label: 'Fast Moving Items',
    description: 'Items with the highest sales quantity in the period.',
    icon: RocketLaunchOutlinedIcon,
    color: '#2563EB',
    useQuery: useFastMovingItemsReportQuery,
    endpoint: inventoryReportsEndpoints.FastMovingItemsReport,
    filters: ['dateRange'],
    defaultRangeDays: 30,
    columns: MOVEMENT_RANKING_COLUMNS,
    exportName: 'fast-moving-items',
    exportHeaders: MOVEMENT_RANKING_EXPORT.headers,
    exportRow: MOVEMENT_RANKING_EXPORT.row,
    summaryTiles: (s) => [
      { icon: RocketLaunchOutlinedIcon, iconColor: '#2563EB', label: 'Days in range', value: String(s.rangeDays) },
      { icon: ReportProblemOutlinedIcon, iconColor: '#E5484D', label: 'Items with zero sales', value: String(s.zeroSaleItems) },
    ],
  },
  'physical-stock-variance': {
    label: 'Physical Stock Variance',
    description: 'Every counted item with a variance, draft or completed — system qty vs. counted qty.',
    icon: AssignmentOutlinedIcon,
    color: '#F26B21',
    useQuery: usePhysicalStockVarianceReportQuery,
    endpoint: inventoryReportsEndpoints.PhysicalStockVarianceReport,
    filters: ['dateRange', 'warehouseName'],
    defaultRangeDays: 30,
    columns: COUNT_VARIANCE_COLUMNS,
    exportName: 'physical-stock-variance',
    exportHeaders: COUNT_VARIANCE_EXPORT.headers,
    exportRow: COUNT_VARIANCE_EXPORT.row,
    summaryTiles: (s) => [
      { icon: AssignmentOutlinedIcon, iconColor: '#F26B21', label: 'Variance lines', value: String(s.totalRecords) },
      { icon: TrendingDownOutlinedIcon, iconColor: '#E5484D', label: 'Shortage value', value: money(s.shortageValue) },
      { icon: TrendingUpOutlinedIcon, iconColor: '#F5A623', label: 'Excess value', value: money(s.excessValue) },
    ],
  },
};

export const INVENTORY_REPORT_ORDER = [
  'current-stock', 'low-stock', 'out-of-stock', 'stock-movement', 'stock-valuation', 'stock-adjustment',
  'wastage', 'batch-expiry', 'slow-moving-items', 'fast-moving-items', 'physical-stock-variance',
];
