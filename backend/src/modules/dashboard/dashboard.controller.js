import * as dashboardService from './dashboard.service.js';
import { isOutletAllowed } from '../../utils/outletScope.js';

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
    // picker. tenantId always comes from the JWT, never the client.
    const data = await dashboardService.getManagementSummary(req.user.tenantId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
