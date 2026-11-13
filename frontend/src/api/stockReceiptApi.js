import { baseApi } from './baseApi';

// Hand-rolled (not createCrudApi), same reason as Stock Indent/Stock
// Transfer: a dedicated summary endpoint the generic crudFactory pattern
// doesn't have a place for, plus a plain `status` list filter. Unlike Stock
// Transfer, there's no separate status-summary endpoint — the reference
// design never had separate Draft/Received status pages for receipts (the
// All/Draft/Received split lives inside StockReceiptTable's own tabs on the
// one Stock Receipt page), so there's nothing to feed there.
const stockReceiptApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    StockReceiptList: builder.query({
      query: (params) => ({ url: '/stock-receipts', params }),
      transformResponse: (response) => response.data,
      providesTags: (result = []) => [
        ...result.map((row) => ({ type: 'StockReceipt', id: row.id })),
        { type: 'StockReceipt', id: 'LIST' },
      ],
    }),
    StockReceiptById: builder.query({
      query: (id) => `/stock-receipts/${id}`,
      transformResponse: (response) => response.data,
      providesTags: (result, error, id) => [{ type: 'StockReceipt', id }],
    }),
    NextStockReceiptCode: builder.query({
      query: () => '/stock-receipts/next-code',
      transformResponse: (response) => response.data.code,
      providesTags: [{ type: 'StockReceipt', id: 'NEXT' }],
    }),
    // Feeds the "Stock Receipt" page's top 5-tile summary strip.
    StockReceiptSummary: builder.query({
      query: () => '/stock-receipts/summary',
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'StockReceipt', id: 'SUMMARY' }],
    }),
    StockReceiptCreate: builder.mutation({
      query: (body) => ({ url: '/stock-receipts', method: 'POST', body }),
      transformResponse: (response) => response.data,
      invalidatesTags: [
        { type: 'StockReceipt', id: 'LIST' },
        { type: 'StockReceipt', id: 'NEXT' },
        { type: 'StockReceipt', id: 'SUMMARY' },
        // Receiving a receipt adds stock (FIFO lots) to products.
        { type: 'Product', id: 'LIST' },
      ],
    }),
    // Excel import: { receipts: [...] } -> { total, created, updated, failed, errors }.
    StockReceiptImport: builder.mutation({
      query: (body) => ({ url: '/stock-receipts/import', method: 'POST', body }),
      transformResponse: (response) => response.data,
      invalidatesTags: [
        { type: 'StockReceipt', id: 'LIST' },
        { type: 'StockReceipt', id: 'NEXT' },
        { type: 'StockReceipt', id: 'SUMMARY' },
      ],
    }),
    StockReceiptUpdate: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/stock-receipts/${id}`, method: 'PUT', body }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, { id }) => [
        { type: 'StockReceipt', id },
        { type: 'StockReceipt', id: 'LIST' },
        { type: 'StockReceipt', id: 'SUMMARY' },
        { type: 'Product', id: 'LIST' },
      ],
    }),
    StockReceiptDelete: builder.mutation({
      query: (id) => ({ url: `/stock-receipts/${id}`, method: 'DELETE' }),
      invalidatesTags: (result, error, id) => [
        { type: 'StockReceipt', id },
        { type: 'StockReceipt', id: 'LIST' },
        { type: 'StockReceipt', id: 'SUMMARY' },
      ],
    }),
  }),
});

export const useGetStockReceiptsQuery = stockReceiptApi.useStockReceiptListQuery;
export const useGetStockReceiptQuery = stockReceiptApi.useStockReceiptByIdQuery;
export const useNextStockReceiptCodeQuery = stockReceiptApi.useNextStockReceiptCodeQuery;
export const useStockReceiptSummaryQuery = stockReceiptApi.useStockReceiptSummaryQuery;
export const useCreateStockReceiptMutation = stockReceiptApi.useStockReceiptCreateMutation;
export const useImportStockReceiptsMutation = stockReceiptApi.useStockReceiptImportMutation;
export const useUpdateStockReceiptMutation = stockReceiptApi.useStockReceiptUpdateMutation;
export const useDeleteStockReceiptMutation = stockReceiptApi.useStockReceiptDeleteMutation;
