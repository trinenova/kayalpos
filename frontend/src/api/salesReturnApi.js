import { baseApi } from './baseApi';

// Hand-rolled (not createCrudApi): a Sales Return isn't a list-and-edit
// master, it's a one-shot POS action against an existing Sale — "look an
// invoice up", "preview the next return number", "process the return".
const salesReturnApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    NextSalesReturnNo: builder.query({
      query: () => '/sales-returns/next-return-no',
      transformResponse: (response) => response.data.returnNo,
      providesTags: [{ type: 'SalesReturn', id: 'NEXT' }],
    }),
    // A lazy query (see useLazyLookupOriginalInvoiceQuery below) — only
    // fires when the cashier actually searches for a bill number, not on
    // page load.
    LookupOriginalInvoice: builder.query({
      query: (billNo) => `/sales-returns/lookup/${encodeURIComponent(billNo)}`,
      transformResponse: (response) => response.data,
    }),
    SalesReturnCreate: builder.mutation({
      query: (body) => ({ url: '/sales-returns', method: 'POST', body }),
      transformResponse: (response) => response.data,
      // Also invalidates the Cashier Panel landing page's summary, whose
      // Alerts panel surfaces today's real return count/total.
      invalidatesTags: [
        { type: 'SalesReturn', id: 'NEXT' },
        { type: 'Product', id: 'LIST' },
        { type: 'CashierPanel', id: 'SUMMARY' },
      ],
    }),
    // Photo evidence for a saved return — one JSON request per photo (the API
    // has no multipart parser; the page downsizes photos before sending).
    SalesReturnEvidenceUpload: builder.mutation({
      query: ({ returnId, fileName, dataUrl }) => ({
        url: `/sales-returns/${encodeURIComponent(returnId)}/evidence`,
        method: 'POST',
        body: { fileName, dataUrl },
      }),
      transformResponse: (response) => response.data,
    }),
  }),
});

export const useNextSalesReturnNoQuery = salesReturnApi.useNextSalesReturnNoQuery;
export const useLazyLookupOriginalInvoiceQuery = salesReturnApi.useLazyLookupOriginalInvoiceQuery;
export const useCreateSalesReturnMutation = salesReturnApi.useSalesReturnCreateMutation;
export const useUploadSalesReturnEvidenceMutation = salesReturnApi.useSalesReturnEvidenceUploadMutation;
