import { baseApi } from './baseApi';

// Read-only: Profitability / Tax Summary / Outstanding / Payment Collection are
// derived on the server — see backend/src/modules/financial-reports/.
// params: { from?, to?, outletId? }
const report = (builder, path) => builder.query({
  query: (params) => ({ url: `/financial-reports/${path}`, params }),
  transformResponse: (response) => response.data,
  providesTags: [{ type: 'Sale', id: 'NEXT' }, { type: 'Expense', id: 'LIST' }, { type: 'StockReceipt', id: 'LIST' }],
});

const financialReportsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    ProfitabilityReport: report(builder, 'profitability'),
    TaxSummaryReport: report(builder, 'tax-summary'),
    OutstandingReport: report(builder, 'outstanding'),
    PaymentCollectionReport: report(builder, 'payment-collection'),
    FinancialReportFilters: builder.query({
      query: () => '/financial-reports/filters',
      transformResponse: (response) => response.data,
    }),
  }),
});

export const useProfitabilityReportQuery = financialReportsApi.useProfitabilityReportQuery;
export const useTaxSummaryReportQuery = financialReportsApi.useTaxSummaryReportQuery;
export const useOutstandingReportQuery = financialReportsApi.useOutstandingReportQuery;
export const usePaymentCollectionReportQuery = financialReportsApi.usePaymentCollectionReportQuery;
export const useFinancialReportFiltersQuery = financialReportsApi.useFinancialReportFiltersQuery;
