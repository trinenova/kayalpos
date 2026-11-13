import { baseApi } from './baseApi';

// Read-only: derived on the server from completed bills and sales returns —
// see backend/src/modules/net-sales/netSales.service.js.
const netSalesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // params: { from?, to?, outletId? }
    NetSalesReport: builder.query({
      query: (params) => ({ url: '/net-sales', params }),
      transformResponse: (response) => response.data,
    }),
    NetSalesFilters: builder.query({
      query: () => '/net-sales/filters',
      transformResponse: (response) => response.data,
    }),
  }),
});

export const useNetSalesReportQuery = netSalesApi.useNetSalesReportQuery;
export const useNetSalesFiltersQuery = netSalesApi.useNetSalesFiltersQuery;
