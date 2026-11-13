import { baseApi } from './baseApi';

// Read-only: every Sales Report is derived on the server from real Sale /
// LinesaleItemDetails / SalesReturn rows — see
// backend/src/modules/sales-reports (salesReports.service.js for Hourly /
// Payment-wise / Discount / Tax / Return, salesReportsSummary.service.js for
// Daily / Monthly / Outlet / Cashier / Item / Category / Brand / Customer).
const salesReportsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Outlets the user may choose from, `canChooseOutlet`, and the cashiers who have sold.
    SalesReportFilters: builder.query({
      query: () => '/reports/sales/filters',
      transformResponse: (response) => response.data,
    }),
    // One endpoint, eight report types: { report: 'daily' | 'monthly' | 'outlet' | 'cashier' | 'item' | 'category' | 'brand' | 'customer', from, to, outletId, cashier, search }.
    SalesSummaryReport: builder.query({
      query: ({ report, ...params }) => ({ url: `/reports/sales/${report}`, params }),
      transformResponse: (response) => response.data,
      providesTags: (result, error, arg) => [{ type: 'SalesReport', id: arg.report }],
    }),
    HourlySalesReport: builder.query({
      query: (params) => ({ url: '/reports/sales/hourly-sales', params }),
      transformResponse: (response) => response.data,
    }),
    HourlySalesItems: builder.query({
      query: ({ hour, ...params }) => ({ url: `/reports/sales/hourly-sales/${hour}/items`, params }),
      transformResponse: (response) => response.data,
    }),
    PaymentWiseSalesReport: builder.query({
      query: (params) => ({ url: '/reports/sales/payment-wise-sales', params }),
      transformResponse: (response) => response.data,
    }),
    DiscountReport: builder.query({
      query: (params) => ({ url: '/reports/sales/discount-report', params }),
      transformResponse: (response) => response.data,
    }),
    TaxReport: builder.query({
      query: (params) => ({ url: '/reports/sales/tax-report', params }),
      transformResponse: (response) => response.data,
    }),
    ReturnReport: builder.query({
      query: (params) => ({ url: '/reports/sales/return-report', params }),
      transformResponse: (response) => response.data,
    }),
  }),
});

export const {
  useSalesReportFiltersQuery, useSalesSummaryReportQuery, useHourlySalesReportQuery, useHourlySalesItemsQuery,
  usePaymentWiseSalesReportQuery, useDiscountReportQuery, useTaxReportQuery, useReturnReportQuery,
} = salesReportsApi;

// Used to fetch every page for each report's CSV export.
export const salesReportsEndpoints = salesReportsApi.endpoints;
