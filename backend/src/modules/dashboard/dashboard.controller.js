import * as dashboardService from './dashboard.service.js';
import { isOutletAllowed } from '../../utils/outletScope.js';
import { getAccess } from '../permission/permission.service.js';

// Administrators (accounts with no restricted role) see every bill; any other
// user only sees the bills they rang up themselves. Returns null for "no
// restriction", otherwise the { userId, name } the dashboard queries filter by.
// Same rule as sale.routes.js's ownScope — role is read from the database (via
// authorize.js's req.access), never trusted from the client.
async function ownScope(req) {
  const access = req.access || await getAccess(req.user.id);
  return access.isSuperAdmin ? null : { userId: req.user.id, name: req.user.name };
}

export async function getHomeSummaryHandler(req, res, next) {
  try {
    // Query outletId (an explicit "which outlet am I viewing" choice on the
    // Home page) wins when present; otherwise fall back to the outlet the
    // cashier/manager is actually logged into (from their JWT). Never trust
    // req.query alone for *scoping* — tenantId always comes from the JWT,
    // never the client, so one tenant can never read another tenant's data
    // by editing the query string.
    const outletId = req.query.outletId || req.user.outletId || undefined;
    // Users limited to specific outlets can't view another outlet's numbers
    // by editing the query string.
    if (outletId && !isOutletAllowed(req.user, outletId)) {
      return res.status(403).json({ success: false, message: 'You do not have access to that outlet' });
    }
    const data = await dashboardService.getHomeSummary(req.user.tenantId, outletId, {
      salesPeriod: req.query.salesPeriod,
      topSellingPeriod: req.query.topSellingPeriod,
      own: await ownScope(req),
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getManagementSummaryHandler(req, res, next) {
  try {
    // Tenant-wide (not outlet-scoped, unlike Home) — this page is a whole-
    // business overview, and its own DashboardDateControl has no outlet
    // picker. tenantId always comes from the JWT, never the client. Bill-based
    // figures are limited to the user's own bills unless they're an admin.
    const data = await dashboardService.getManagementSummary(req.user.tenantId, await ownScope(req));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
