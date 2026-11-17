import { baseApi } from './baseApi';

// Hand-rolled (not createCrudApi), same reason as Sales Order/Sales Invoice:
// dedicated summary endpoints the generic crudFactory pattern doesn't have a
// place for, plus a plain `status` list filter (no live-derived state here —
// 'printed' is now reachable through BarcodeLabelGenerate below).
const barcodeLabelApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    BarcodeLabelList: builder.query({
      query: (params) => ({ url: '/barcode-labels', params }),
      transformResponse: (response) => response.data,
      providesTags: (result = []) => [
        ...result.map((row) => ({ type: 'BarcodeLabel', id: row.id })),
        { type: 'BarcodeLabel', id: 'LIST' },
      ],
    }),
    BarcodeLabelById: builder.query({
      query: (id) => `/barcode-labels/${id}`,
      transformResponse: (response) => response.data,
      providesTags: (result, error, id) => [{ type: 'BarcodeLabel', id }],
    }),
    NextBarcodeLabelCode: builder.query({
      query: () => '/barcode-labels/next-code',
      transformResponse: (response) => response.data.code,
      providesTags: [{ type: 'BarcodeLabel', id: 'NEXT' }],
    }),
    // Feeds the "Barcode & Label" page's top 5-tile summary strip.
    BarcodeLabelSummary: builder.query({
      query: () => '/barcode-labels/summary',
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'BarcodeLabel', id: 'SUMMARY' }],
    }),
    // Feeds the Draft/Pending Print/Printed status pages' 4-tile strip, one
    // status at a time.
    BarcodeLabelStatusSummary: builder.query({
      query: (status) => `/barcode-labels/status-summary/${status}`,
      transformResponse: (response) => response.data,
      providesTags: (result, error, status) => [{ type: 'BarcodeLabel', id: `STATUS_SUMMARY_${status}` }],
    }),
    BarcodeLabelCreate: builder.mutation({
      query: (body) => ({ url: '/barcode-labels', method: 'POST', body }),
      transformResponse: (response) => response.data,
      invalidatesTags: [
        { type: 'BarcodeLabel', id: 'LIST' },
        { type: 'BarcodeLabel', id: 'NEXT' },
        { type: 'BarcodeLabel', id: 'SUMMARY' },
      ],
    }),
    BarcodeLabelUpdate: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/barcode-labels/${id}`, method: 'PUT', body }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, { id }) => [
        { type: 'BarcodeLabel', id },
        { type: 'BarcodeLabel', id: 'LIST' },
        { type: 'BarcodeLabel', id: 'SUMMARY' },
      ],
    }),
    BarcodeLabelDelete: builder.mutation({
      query: (id) => ({ url: `/barcode-labels/${id}`, method: 'DELETE' }),
      invalidatesTags: (result, error, id) => [
        { type: 'BarcodeLabel', id },
        { type: 'BarcodeLabel', id: 'LIST' },
        { type: 'BarcodeLabel', id: 'SUMMARY' },
      ],
    }),
    // The real "Generate" action behind Print / Preview's "Generate & Save
    // to History" button (see BarcodePrintDialog) — POSTs to
    // /barcode-labels/:id/generate, which logs every item's resolved
    // barcode value to the permanent history and flips the batch to
    // 'printed'. Invalidates every tile/list/tab that status change can
    // affect, plus the history list itself.
    BarcodeLabelGenerate: builder.mutation({
      query: (id) => ({ url: `/barcode-labels/${id}/generate`, method: 'POST' }),
      transformResponse: (response) => response.data,
      invalidatesTags: (result, error, id) => [
        { type: 'BarcodeLabel', id },
        { type: 'BarcodeLabel', id: 'LIST' },
        { type: 'BarcodeLabel', id: 'SUMMARY' },
        { type: 'BarcodeLabel', id: 'STATUS_SUMMARY_draft' },
        { type: 'BarcodeLabel', id: 'STATUS_SUMMARY_pending-print' },
        { type: 'BarcodeLabel', id: 'STATUS_SUMMARY_printed' },
        { type: 'BarcodeHistory', id: 'LIST' },
      ],
    }),
    // Feeds the "Barcode History" tab — every barcode value ever actually
    // generated for print, newest first (see barcodeLabel.service.js's
    // listBarcodeGenerationHistory).
    BarcodeHistoryList: builder.query({
      query: (params) => ({ url: '/barcode-labels/history', params }),
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'BarcodeHistory', id: 'LIST' }],
    }),
  }),
});

export const useGetBarcodeLabelBatchesQuery = barcodeLabelApi.useBarcodeLabelListQuery;
export const useGetBarcodeLabelBatchQuery = barcodeLabelApi.useBarcodeLabelByIdQuery;
export const useNextBarcodeLabelCodeQuery = barcodeLabelApi.useNextBarcodeLabelCodeQuery;
export const useBarcodeLabelSummaryQuery = barcodeLabelApi.useBarcodeLabelSummaryQuery;
export const useBarcodeLabelStatusSummaryQuery = barcodeLabelApi.useBarcodeLabelStatusSummaryQuery;
export const useCreateBarcodeLabelMutation = barcodeLabelApi.useBarcodeLabelCreateMutation;
export const useUpdateBarcodeLabelMutation = barcodeLabelApi.useBarcodeLabelUpdateMutation;
export const useDeleteBarcodeLabelMutation = barcodeLabelApi.useBarcodeLabelDeleteMutation;
export const useGenerateBarcodeLabelMutation = barcodeLabelApi.useBarcodeLabelGenerateMutation;
export const useBarcodeHistoryQuery = barcodeLabelApi.useBarcodeHistoryListQuery;
