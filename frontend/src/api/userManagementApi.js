import { baseApi } from './baseApi';

// Users (/api/users) and Roles (/api/roles) for the User Management page.
// Both lists show cross-referenced data (a role's user count, a user's role
// name), so every write invalidates both tags.
const unwrap = (response) => response.data;
const both = [{ type: 'User', id: 'LIST' }, { type: 'Role', id: 'LIST' }];

const userManagementApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    UserList: builder.query({
      query: () => '/users',
      transformResponse: unwrap,
      providesTags: [{ type: 'User', id: 'LIST' }],
    }),
    UserCreate: builder.mutation({
      query: (body) => ({ url: '/users', method: 'POST', body }),
      invalidatesTags: both,
    }),
    UserUpdate: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/users/${id}`, method: 'PUT', body }),
      invalidatesTags: both,
    }),
    UserDeactivate: builder.mutation({
      query: (id) => ({ url: `/users/${id}`, method: 'DELETE' }),
      invalidatesTags: both,
    }),
    RoleList: builder.query({
      query: () => '/roles',
      transformResponse: unwrap,
      providesTags: [{ type: 'Role', id: 'LIST' }],
    }),
    RoleCreate: builder.mutation({
      query: (body) => ({ url: '/roles', method: 'POST', body }),
      invalidatesTags: both,
    }),
    RoleUpdate: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/roles/${id}`, method: 'PUT', body }),
      invalidatesTags: both,
    }),
    RoleDelete: builder.mutation({
      query: (id) => ({ url: `/roles/${id}`, method: 'DELETE' }),
      invalidatesTags: both,
    }),
  }),
});

export const useGetUsersQuery = userManagementApi.useUserListQuery;
export const useCreateUserMutation = userManagementApi.useUserCreateMutation;
export const useUpdateUserMutation = userManagementApi.useUserUpdateMutation;
export const useDeactivateUserMutation = userManagementApi.useUserDeactivateMutation;
export const useGetRolesQuery = userManagementApi.useRoleListQuery;
export const useCreateRoleMutation = userManagementApi.useRoleCreateMutation;
export const useUpdateRoleMutation = userManagementApi.useRoleUpdateMutation;
export const useDeleteRoleMutation = userManagementApi.useRoleDeleteMutation;
