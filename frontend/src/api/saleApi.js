import { baseApi } from './baseApi';

// Sale doesn't follow the generic createCrudApi shape (createCustomerApi,
// productApi, ...) because it isn't a flat master-data table — creating one
// needs a cart of lines validated/priced server-side, not a plain
// POST-the-form-body. Injected directly into the same baseApi instance so
// its cache tag ('Sale') and auth header still come from the one shared
// client.
const saleApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Live "LS-00001"-style preview of the bill the current cart will get
    // once paid — same "preview, not a reservation" caveat as the
    // Customer/Product next-code previews.
    NextBillNo: builder.query({
      query: () => '/sales/next-bill-no',
      transformResponse: (response) => response.data.billNo,
      // Invalidated by CreateSale below, so the preview moves on to the
      // next number as soon as the current bill is actually saved.
      providesTags: [{ type: 'Sale', id: 'NEXT' }],
    }),
    // Last 10 bills for the Line Sale "Recent Sales" popup. Refetched after
    // every sale because CreateSale invalidates the 'Sale' NEXT tag below.
    RecentSales: builder.query({
      query: () => '/sales/recent',
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'Sale', id: 'NEXT' }],
    }),
    // One bill's full detail (lines etc.) for Recent Sales View / Print.
    BillDetail: builder.query({
      query: (billNo) => `/sales/bill/${encodeURIComponent(billNo)}`,
      transformResponse: (response) => response.data,
    }),
    CreateSale: builder.mutation({
      query: (body) => ({ url: '/sales', method: 'POST', body }),
      transformResponse: (response) => response.data,
      // A paid sale changes stock (any screen showing Product data should
      // refetch), moves the next bill number on by one, changes the
      // Promotion page's discount-summary report, changes the Customer
      // page's sales-derived tiles/columns, and — when billed to a specific
      // customer — that customer's own purchase summary/recent transactions.
      invalidatesTags: (result, error, arg) => [
        { type: 'Product', id: 'LIST' },
        { type: 'Sale', id: 'NEXT' },
        // Paying a resumed bill closes its held bill out server-side.
        { type: 'HeldBill', id: 'LIST' },
        { type: 'Sale', id: 'DISCOUNT_SUMMARY' },
        { type: 'Sale', id: 'OVERVIEW_SUMMARY' },
        { type: 'Sale', id: 'CUSTOMER_SUMMARIES' },
        // A cash/card sale changes that tender's own report tiles/summary/
        // transactions list; a sale of the other tender doesn't touch it.
        ...(arg?.paymentMethod === 'cash' ? [{ type: 'Sale', id: 'CASH_SUMMARY' }] : []),
        ...(arg?.paymentMethod === 'card' ? [{ type: 'Sale', id: 'CARD_SUMMARY' }] : []),
        ...(arg?.paymentMethod === 'upi' ? [{ type: 'Sale', id: 'UPI_SUMMARY' }] : []),
        // Every sale can move the Other Payments report: directly when its
        // own tender is one of the "other" ones, or indirectly when it's
        // cash/card/upi, since that report also shows same-day cash/card/upi
        // totals as reconciliation context (see getOtherPaymentsReport).
        { type: 'Sale', id: 'OTHER_SUMMARY' },
        ...(arg?.customerId ? [{ type: 'Sale', id: `CUSTOMER_${arg.customerId}` }] : []),
        // Every sale moves the Cashier Panel landing page's Payment
        // Summary (Today)/stat strip/Recent Transactions feed.
        { type: 'CashierPanel', id: 'SUMMARY' },
      ],
    }),
    // Real discount totals (trend + by-outlet) computed from actual Sale
    // rows — see backend/src/modules/sale/sale.service.js's
    // getDiscountSummary for exactly what this reports.
    DiscountSummary: builder.query({
      query: () => '/sales/discount-summary',
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'Sale', id: 'DISCOUNT_SUMMARY' }],
    }),
    // Real "Total Sales (This Month)"/"Outstanding Amount" for the Customer
    // page's top tiles — see sale.service.js's getSalesOverviewSummary.
    SalesOverviewSummary: builder.query({
      query: () => '/sales/overview-summary',
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'Sale', id: 'OVERVIEW_SUMMARY' }],
    }),
    // Real per-customer Total Purchase/Outstanding, keyed by customerId, for
    // the Customer list table's columns — one query for every customer
    // instead of one per row. See getCustomerPurchaseSummaries.
    CustomerSalesSummaries: builder.query({
      query: () => '/sales/customer-summaries',
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'Sale', id: 'CUSTOMER_SUMMARIES' }],
    }),
    // Real Total Purchase/Outstanding + Recent Transactions for one
    // customer's detail panel/view page. See getCustomerPurchaseSummary.
    CustomerSales: builder.query({
      query: (customerId) => `/sales/customer/${customerId}`,
      transformResponse: (response) => response.data,
      providesTags: (result, error, customerId) => [{ type: 'Sale', id: `CUSTOMER_${customerId}` }],
    }),
    // Real Cash Sales report (stat tiles, Sales/Payment Summary, donut,
    // paginated transactions) for the Cashier Panel's Cash Sales page — see
    // sale.service.js's getCashSalesReport for exactly what each field
    // means. `params`: { date?: 'YYYY-MM-DD', page?, pageSize? }.
    CashSalesReport: builder.query({
      query: (params) => ({ url: '/sales/cash-summary', params }),
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'Sale', id: 'CASH_SUMMARY' }],
    }),
    // Real Card Sales report — same shape as CashSalesReport above, scoped
    // to card-tender sales. See sale.service.js's getCardSalesReport.
    // `params`: { date?: 'YYYY-MM-DD', page?, pageSize? }.
    CardSalesReport: builder.query({
      query: (params) => ({ url: '/sales/card-summary', params }),
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'Sale', id: 'CARD_SUMMARY' }],
    }),
    // Real UPI Sales report — same shape as CashSalesReport above, scoped
    // to UPI-tender sales. See sale.service.js's getUpiSalesReport.
    // `params`: { date?: 'YYYY-MM-DD', page?, pageSize? }.
    UpiSalesReport: builder.query({
      query: (params) => ({ url: '/sales/upi-summary', params }),
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'Sale', id: 'UPI_SUMMARY' }],
    }),
    // Real Other Payments report (miscellaneous tenders — store credit,
    // gift card, wallet, credit, cheque, bank transfer — plus same-day
    // cash/card/upi context lines). See sale.service.js's
    // getOtherPaymentsReport. `params`: { date?: 'YYYY-MM-DD', page?, pageSize? }.
    OtherPaymentsReport: builder.query({
      query: (params) => ({ url: '/sales/other-summary', params }),
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'Sale', id: 'OTHER_SUMMARY' }],
    }),
  }),
});

export const useNextBillNoQuery = saleApi.useNextBillNoQuery;
export const useCreateSaleMutation = saleApi.useCreateSaleMutation;
export const useDiscountSummaryQuery = saleApi.useDiscountSummaryQuery;
export const useSalesOverviewSummaryQuery = saleApi.useSalesOverviewSummaryQuery;
export const useCustomerSalesSummariesQuery = saleApi.useCustomerSalesSummariesQuery;
export const useCustomerSalesQuery = saleApi.useCustomerSalesQuery;
export const useCashSalesReportQuery = saleApi.useCashSalesReportQuery;
export const useCardSalesReportQuery = saleApi.useCardSalesReportQuery;
export const useUpiSalesReportQuery = saleApi.useUpiSalesReportQuery;
export const useOtherPaymentsReportQuery = saleApi.useOtherPaymentsReportQuery;
export const useRecentSalesQuery = saleApi.useRecentSalesQuery;
export const useLazyBillDetailQuery = saleApi.useLazyBillDetailQuery;
