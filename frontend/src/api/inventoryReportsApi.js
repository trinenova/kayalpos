import { baseApi } from './baseApi';

// Read-only: every Inventory Report is derived on the server from real
// Product / BatchSerial / StockWastage / StockCount / StockReceipt /
// StockReturn / Sale rows — see
// backend/src/modules/inventory-reports/inventoryReports.service.js.
const inventoryReportsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    InventoryReportFilters: builder.query({
      query: () => '/reports/inventory/filters',
      transformResponse: (response) => response.data,
    }),
    CurrentStockReport: builder.query({
      query: (params) => ({ url: '/reports/inventory/current-stock', params }),
      transformResponse: (response) => response.data,
    }),
    LowStockReport: builder.query({
      query: (params) => ({ url: '/reports/inventory/low-stock', params }),
      transformResponse: (response) => response.data,
    }),
    OutOfStockReport: builder.query({
      query: (params) => ({ url: '/reports/inventory/out-of-stock', params }),
      transformResponse: (response) => response.data,
    }),
    StockValuationReport: builder.query({
      query: (params) => ({ url: '/reports/inventory/stock-valuation', params }),
      transformResponse: (response) => response.data,
    }),
    BatchExpiryReport: builder.query({
      query: (params) => ({ url: '/reports/inventory/batch-expiry', params }),
      transformResponse: (response) => response.data,
    }),
    WastageReport: builder.query({
      query: (params) => ({ url: '/reports/inventory/wastage', params }),
      transformResponse: (response) => response.data,
    }),
    StockAdjustmentReport: builder.query({
      query: (params) => ({ url: '/reports/inventory/stock-adjustment', params }),
      transformResponse: (response) => response.data,
    }),
    PhysicalStockVarianceReport: builder.query({
      query: (params) => ({ url: '/reports/inventory/physical-stock-variance', params }),
      transformResponse: (response) => response.data,
    }),
    SlowMovingItemsReport: builder.query({
      query: (params) => ({ url: '/reports/inventory/slow-moving-items', params }),
      transformResponse: (response) => response.data,
    }),
    FastMovingItemsReport: builder.query({
      query: (params) => ({ url: '/reports/inventory/fast-moving-items', params }),
      transformResponse: (response) => response.data,
    }),
    StockMovementReport: builder.query({
      query: (params) => ({ url: '/reports/inventory/stock-movement', params }),
      transformResponse: (response) => response.data,
    }),
  }),
});

export const {
  useInventoryReportFiltersQuery,
  useCurrentStockReportQuery,
  useLowStockReportQuery,
  useOutOfStockReportQuery,
  useStockValuationReportQuery,
  useBatchExpiryReportQuery,
  useWastageReportQuery,
  useStockAdjustmentReportQuery,
  usePhysicalStockVarianceReportQuery,
  useSlowMovingItemsReportQuery,
  useFastMovingItemsReportQuery,
  useStockMovementReportQuery,
} = inventoryReportsApi;

// Used to fetch every page for each report's CSV export.
export const inventoryReportsEndpoints = inventoryReportsApi.endpoints;
