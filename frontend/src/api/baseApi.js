import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { logout } from '../features/auth/authSlice';
import { showToast } from '../features/ui/uiSlice';

// Exported so other clients that don't go through RTK Query (e.g. the
// health-check poller, which needs its own timeout/abort handling) can
// still point at the same backend without duplicating the env fallback.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth?.token;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

// The backend's requireAuth (backend/src/middleware/auth.js) returns 401 for
// a missing, invalid, OR EXPIRED token (tokens are signed with a 12h expiry —
// see auth.service.js) — and nothing used to react to that on the client.
// Redux kept `token` set, so ProtectedRoute (which only checks "is there a
// token", not "is it still valid") kept rendering the page, every query on
// it failed with 401, and screens like Home just showed a permanent generic
// error with no way out except a manual logout.
//
// This wrapper is the single choke point all RTK Query requests go through:
// on any 401, it clears the stale session and shows a toast, so
// ProtectedRoute's isAuthenticated check flips to false on its own and the
// user is bounced back to /login instead of stuck on a dead page. The
// `token` guard avoids this firing for a plain wrong-password response from
// POST /auth/login, which is also a 401 but happens before any token exists.
const baseQueryWithReauth = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401 && api.getState().auth?.token) {
    api.dispatch(logout());
    api.dispatch(showToast('Your session has expired. Please log in again.', 'warning'));
  }

  // 403 = signed in, but the user's role lacks this permission (see
  // backend/src/middleware/authorize.js). Say so instead of failing silently.
  if (result.error?.status === 403) {
    api.dispatch(showToast(result.error.data?.message || 'You do not have permission to do that.', 'warning'));
  }

  return result;
};

// Single RTK Query base API. Every domain (auth, items, customers, sales, ...)
// injects its endpoints into this one instance instead of creating separate
// createApi() clients, so cache tags and the store slice stay unified.
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Auth', 'Brand', 'ItemGroup', 'Outlet', 'Warehouse', 'Product', 'Customer', 'Supplier', 'Sale', 'Promotion', 'GiftVoucher', 'LoyaltyProgram', 'SalesQuotation', 'SalesReturn', 'SalesOrder', 'SalesInvoice', 'BarcodeLabel', 'StockIndent', 'StockTransfer', 'StockReceipt', 'StockReturn', 'StockWastage', 'StockCount', 'ShiftSession', 'CashWithdrawal', 'CashDeposit', 'CashTransfer', 'CashDrawerOpening', 'ShiftClosing', 'CashReconciliation', 'ShortageExcess', 'CashierWiseSales', 'CashierPanel', 'Expense', 'Company', 'UomGroup', 'Uom', 'TaxCode', 'HsnSac', 'HeldBill', 'User', 'Role', 'SalesReport', 'Notification'],
  endpoints: () => ({}),
});
