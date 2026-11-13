import { createCrudApi, useNextCodePreview } from './createCrudApi';

const { api, hooks } = createCrudApi({ entity: 'Supplier', path: '/masters/supplier' });

// Excel import — one call per chunk from the shared ExcelImportDialog.
const supplierImportApi = api.injectEndpoints({
  endpoints: (builder) => ({
    SupplierImport: builder.mutation({
      query: ({ rows }) => ({ url: '/masters/supplier/import', method: 'POST', body: { rows } }),
      transformResponse: (response) => response.data,
      invalidatesTags: [{ type: 'Supplier', id: 'LIST' }],
    }),
  }),
});

export const useGetSuppliersQuery = hooks.useListQuery;
export const useGetSupplierQuery = hooks.useByIdQuery;
export const useCreateSupplierMutation = hooks.useCreateMutation;
export const useUpdateSupplierMutation = hooks.useUpdateMutation;
export const useDeleteSupplierMutation = hooks.useDeleteMutation;
export const useImportSuppliersMutation = supplierImportApi.useSupplierImportMutation;

// Live "SUPP-0011"-style preview for the Add Supplier dialog's disabled Code
// field — matches supplier.routes.js's codePrefix: 'SUPP' (default codeLength 4).
export function useNextSupplierCode(enabled) {
  return useNextCodePreview(hooks.useListPageQuery, { prefix: 'SUPP', codeLength: 4, enabled });
}
