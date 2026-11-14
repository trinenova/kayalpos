import { requireAuth } from './auth.js';
import { ApiError } from './errorHandler.js';
import { getAccess, can } from '../modules/permission/permission.service.js';

const ACTION_BY_METHOD = {
  GET: 'view', HEAD: 'view', POST: 'add', PUT: 'edit', PATCH: 'edit', DELETE: 'delete',
};

const ACTION_WORD = {
  view: 'view', add: 'create', edit: 'edit', delete: 'delete',
};

/**
 * Route-level RBAC, mounted once per API prefix in app.js:
 *
 *   app.use('/api/stock-receipts', authorize('stock-receipt', { alsoView: ['reports'] }), router);
 *
 * It verifies the token (requireAuth), then maps the HTTP method to a
 * permission action — GET -> view, POST -> add, PUT/PATCH -> edit,
 * DELETE -> delete — and checks it against the user's role.
 *
 * Options:
 *  - lookup:   reference data other screens need to fill their dropdowns
 *              (products, customers, outlets...). Any signed-in user may GET
 *              it; writes still need the menu's own add/edit/delete.
 *  - publicRead: GET without any token is left to the router (login-screen data).
 *  - alsoView: other menu keys (or groups, e.g. 'reports') whose `view`
 *              also unlocks GET here — e.g. Reports read the sales data.
 */
export function authorize(menuKey, { lookup = false, alsoView = [], publicRead = false } = {}) {
  const check = async (req, res, next) => {
    try {
      const action = ACTION_BY_METHOD[req.method] || 'edit';
      req.access = await getAccess(req.user.id);

      // Outlet access (User Management): expose the user's allowed outlets to
      // services, and refuse a session whose outlet was taken away after the
      // token was issued (e.g. an admin removed it while the user was signed in).
      const allowedOutletIds = req.access.allowedOutletIds || [];
      req.user.allowedOutletIds = allowedOutletIds;
      if (allowedOutletIds.length && req.user.outletId && !allowedOutletIds.includes(req.user.outletId)) {
        return next(new ApiError(403, 'You no longer have access to this outlet. Please switch outlet or sign in again.'));
      }

      if (action === 'view' && lookup) return next();
      if (can(req.access, menuKey, action)) return next();
      if (action === 'view' && alsoView.some((key) => can(req.access, key, 'view'))) return next();

      return next(new ApiError(403, `You do not have permission to ${ACTION_WORD[action]} here`));
    } catch (err) {
      return next(err);
    }
  };
  // publicRead: a GET with no Authorization header at all goes straight to the
  // router, which decides for itself (e.g. the login screen's outlet dropdown
  // is fetched before anyone is signed in). Any request that carries a token
  // is still fully checked.
  return (req, res, next) => {
    if (publicRead && req.method === 'GET' && !req.headers.authorization) return next();
    return requireAuth(req, res, (err) => (err ? next(err) : check(req, res, next)));
  };
}
