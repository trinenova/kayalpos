import { createCrudApi, useNextCodePreview } from './createCrudApi';

const { hooks } = createCrudApi({ entity: 'ItemGroup', path: '/masters/item-group' });

export const useGetItemGroupsQuery = hooks.useListQuery;
export const useGetItemGroupQuery = hooks.useByIdQuery;
export const useCreateItemGroupMutation = hooks.useCreateMutation;
export const useUpdateItemGroupMutation = hooks.useUpdateMutation;
export const useDeleteItemGroupMutation = hooks.useDeleteMutation;

// Live "IG0011"-style preview for the Add Item Group dialog's disabled Code
// field — matches itemGroup.routes.js's codePrefix: 'IG' (default length 4).
export function useNextItemGroupCode(enabled) {
  return useNextCodePreview(hooks.useListPageQuery, { prefix: 'IG', codeLength: 4, enabled });
}
