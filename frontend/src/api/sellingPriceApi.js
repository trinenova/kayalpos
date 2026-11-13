import { createCrudApi } from './createCrudApi';
import { baseApi } from './baseApi';

// Masters > Selling Price — backed by the real backend module (see
// backend/src/modules/selling-price). No `codePrefix` here (SellingPrice has
// no `code` field, unlike Brand/Product/Outlet) so there's no
// useNextCodePreview export to go with it.
//
// The backend route (sellingPrice.routes.js) doesn't use utils/crudFactory.js
// — it has its own list/get/create/update/delete with Product/Outlet joins
// and server-side price recalculation — but its response shapes
// ({success,data} / {success,data,meta}) match crudFactory's exactly, so the
// generic createCrudApi injector below still works against it unchanged.
const { hooks } = createCrudApi({ entity: 'SellingPrice', path: '/masters/selling-price' });

export const useGetSellingPricesQuery = hooks.useListQuery;
export const useGetSellingPricesPageQuery = hooks.useListPageQuery;
export const useGetSellingPriceQuery = hooks.useByIdQuery;
export const useCreateSellingPriceMutation = hooks.useCreateMutation;
export const useUpdateSellingPriceMutation = hooks.useUpdateMutation;
export const useDeleteSellingPriceMutation = hooks.useDeleteMutation;

// Price List screen's flat grid — hand-rolled (not createCrudApi) since the
// backend's GET /grid and POST /grid/bulk-update aren't a plain list/get/
// create/update/delete CRUD surface (see sellingPrice.routes.js).
const priceGridApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    PriceGrid: builder.query({
      query: (params) => ({ url: '/masters/selling-price/grid', params }),
      transformResponse: (response) => response.data,
      providesTags: [{ type: 'SellingPrice', id: 'GRID' }],
    }),
    BulkUpdatePriceGrid: builder.mutation({
      query: (body) => ({ url: '/masters/selling-price/grid/bulk-update', method: 'POST', body }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'SellingPrice', id: 'GRID' }],
    }),
    // Actions column's "Price History" dialog — skipped (see the dialog)
    // until a product id is actually clicked. Always refetched on open
    // (rather than relying on cache invalidation, which would need the
    // bulk-update mutation above to know every affected product's tag)
    // since a bulk update elsewhere could have changed this exact product's
    // history since the last time this dialog was open.
    PriceHistory: builder.query({
      query: (productId) => ({ url: `/masters/selling-price/grid/${productId}/history` }),
      transformResponse: (response) => response.data,
    }),
  }),
});

export const useGetPriceGridQuery = priceGridApi.usePriceGridQuery;
export const useBulkUpdatePriceGridMutation = priceGridApi.useBulkUpdatePriceGridMutation;
export const useGetPriceHistoryQuery = priceGridApi.usePriceHistoryQuery;
