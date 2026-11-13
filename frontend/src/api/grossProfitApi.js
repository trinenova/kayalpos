import { baseApi } from './baseApi';

// Read-only: derived on the server from real sales lines and product purchase
// cost — see backend/src/modules/gross-profit/grossProfit.service.js.
const grossProfitApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // params: { from?, to?, outletId? }
    GrossProfitReport: builder.query({
      query: (params) => ({ url: '/gross-profit', params }),
      transformResponse: (response) => response.data,
    }),
    GrossProfitFilters: builder.query({
      query: () => '/gross-profit/filters',
      transformResponse: (response) => response.data,
    }),
  }),
});

export const useGrossProfitReportQuery = grossProfitApi.useGrossProfitReportQuery;
export const useGrossProfitFiltersQuery = grossProfitApi.useGrossProfitFiltersQuery;
