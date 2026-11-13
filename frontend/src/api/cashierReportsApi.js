import { baseApi } from './baseApi';

// Read-only: every Cashier Report is derived on the server from real Sale /
// LinesaleItemDetails / SalesReturn / ShiftSession rows — see
// backend/src/modules/cashier-reports/cashierReports.service.js.
const cashierReportsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    CashierReportFilters: builder.query({
      query: () => '/reports/cashier/filters',
      transformResponse: (response) => response.data,
    }),
    CashierSalesReport: builder.query({
      query: (params) => ({ url: '/reports/cashier/cashier-sales', params }),
      transformResponse: (response) => response.data,
    }),
    PaymentCollectionReport: builder.query({
      query: (params) => ({ url: '/reports/cashier/payment-collection', params }),
      transformResponse: (response) => response.data,
    }),
    CashShortageExcessReport: builder.query({
      query: (params) => ({ url: '/reports/cashier/cash-shortage-excess', params }),
      transformResponse: (response) => response.data,
    }),
  }),
});

export const {
  useCashierReportFiltersQuery, useCashierSalesReportQuery, usePaymentCollectionReportQuery, useCashShortageExcessReportQuery,
} = cashierReportsApi;

// Used to fetch every page for each report's CSV export.
export const cashierReportsEndpoints = cashierReportsApi.endpoints;
