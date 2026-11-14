import { baseApi } from './baseApi';

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      // Unwrap the { success, data } envelope so callers get { user, token } directly.
      transformResponse: (response) => response.data,
    }),
    // Server-side outlet switch: returns { user, token } for the new outlet.
    switchOutlet: builder.mutation({
      query: (outletId) => ({ url: '/auth/switch-outlet', method: 'POST', body: { outletId } }),
      transformResponse: (response) => response.data,
    }),
    // Current role + permission matrix of the signed-in user.
    getMe: builder.query({
      query: () => '/auth/me',
      transformResponse: (response) => response.data,
    }),
    changePassword: builder.mutation({
      query: ({ currentPassword, newPassword }) => ({
        url: '/auth/change-password',
        method: 'POST',
        body: { currentPassword, newPassword },
      }),
      transformResponse: (response) => response.data,
    }),
  }),
});

export const { useLoginMutation, useSwitchOutletMutation, useChangePasswordMutation, useGetMeQuery } = authApi;
