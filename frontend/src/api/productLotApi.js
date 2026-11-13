import { baseApi } from './baseApi';

// Open FIFO purchase lots (oldest first) — see
// backend/src/modules/product-lot/productLot.service.js. Line Sale uses them to
// price a quantity across lots. Refetched whenever products or receipts change.
const productLotApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    ProductLotList: builder.query({
      query: () => '/product-lots',
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'Product', id: 'LIST' }, { type: 'StockReceipt', id: 'LIST' }],
    }),
  }),
});

export const useGetProductLotsQuery = productLotApi.useProductLotListQuery;
