import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { logout } from '../features/auth/authSlice';
import { showToast } from '../features/ui/uiSlice';

// VITE_API_BASE_URL may hold ONE url or a comma-separated list, e.g.
//   VITE_API_BASE_URL=http://localhost:4000/api,http://192.168.1.12:5001/api
// Earlier entries have priority. The app probes each one's /health and uses
// the first that answers; if the active one later stops responding (network
// error) it re-probes and fails over to the next reachable URL.
const FALLBACK_URL = 'http://localhost:4000/api';
export const API_BASE_URLS = (import.meta.env.VITE_API_BASE_URL || FALLBACK_URL)
  .split(',')
  .map((u) => u.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const PROBE_TIMEOUT_MS = 3000;
let activeBaseUrl = API_BASE_URLS[0];
let resolving = null;
let resolved = false;

async function probe(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    // Any HTTP response (even 503 from a failing DB check) means the server
    // is reachable; only network errors / timeouts count as "down".
    await fetch(`${url}/health`, { signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Resolves (and caches) the base URL to use. With a single URL this is a
// no-op. `force` re-probes the list, keeping list order as priority.
export function resolveApiBaseUrl(force = false) {
  if (API_BASE_URLS.length === 1) return Promise.resolve(API_BASE_URLS[0]);
  if (resolving) return resolving;
  if (!force && resolved) return Promise.resolve(activeBaseUrl);

  resolving = Promise.all(API_BASE_URLS.map(probe))
    .then((results) => {
      const idx = results.findIndex(Boolean);
      // Nothing reachable: keep the current one so normal error handling runs.
      if (idx !== -1) activeBaseUrl = API_BASE_URLS[idx];
      resolved = true;
      return activeBaseUrl;
    })
    .finally(() => {
      resolving = null;
    });
  return resolving;
}
// Synchronous accessor for code that can't await (kept for compatibility).
export const getApiBaseUrl = () => activeBaseUrl;
export const API_BASE_URL = API_BASE_URLS[0];

const prepareHeaders = (headers, { getState }) => {
  const token = getState().auth?.token;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
};

const queryCache = new Map();
const queryFor = (baseUrl) => {
  if (!queryCache.has(baseUrl)) {
    queryCache.set(baseUrl, fetchBaseQuery({ baseUrl, prepareHeaders }));
  }
  return queryCache.get(baseUrl);
};

const rawBaseQuery = async (args, api, extraOptions) => {
  const base = await resolveApiBaseUrl();
  let result = await queryFor(base)(args, api, extraOptions);

  // Server unreachable -> re-probe the list and retry once on another URL.
  if (result.error?.status === 'FETCH_ERROR' && API_BASE_URLS.length > 1) {
    const next = await resolveApiBaseUrl(true);
    if (next !== base) {
      result = await queryFor(next)(args, api, extraOptions);
    }
  }
  return result;
};

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
  tagTypes: ['Auth', 'Brand', 'ItemGroup', 'Outlet', 'Warehouse', 'Product', 'Customer', 'Supplier', 'Sale', 'Promotion', 'GiftVoucher', 'LoyaltyProgram', 'SalesQuotation', 'SalesReturn', 'SalesOrder', 'SalesInvoice', 'BarcodeLabel', 'BarcodeHistory', 'StockIndent', 'StockTransfer', 'StockReceipt', 'StockReturn', 'StockWastage', 'StockCount', 'ShiftSession', 'CashWithdrawal', 'CashDeposit', 'CashTransfer', 'CashDrawerOpening', 'ShiftClosing', 'CashReconciliation', 'ShortageExcess', 'CashierWiseSales', 'CashierPanel', 'Expense', 'Company', 'UomGroup', 'Uom', 'TaxCode', 'HsnSac', 'HeldBill', 'User', 'Role', 'SalesReport', 'Notification'],
  endpoints: () => ({}),
});
