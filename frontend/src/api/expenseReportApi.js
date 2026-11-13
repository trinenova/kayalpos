import { baseApi } from './baseApi';

// Read-only: derived on the server from real Expense rows — see
// backend/src/modules/expense-report/expenseReport.service.js.
const expenseReportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // params: { from?, to?, outletId?, category? }
    ExpenseSummaryReport: builder.query({
      query: (params) => ({ url: '/expense-report', params }),
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'Expense', id: 'LIST' }],
    }),
    ExpenseSummaryReportFilters: builder.query({
      query: () => '/expense-report/filters',
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'Expense', id: 'LIST' }],
    }),
  }),
});

export const useExpenseReportQuery = expenseReportApi.useExpenseSummaryReportQuery;
export const useExpenseReportFiltersQuery = expenseReportApi.useExpenseSummaryReportFiltersQuery;
