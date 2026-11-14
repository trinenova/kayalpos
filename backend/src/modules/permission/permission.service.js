import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { hasPermission, normalizePermissions } from './permissionCatalog.js';

/**
 * Resolves what the signed-in user may do, straight from the database on
 * every call (never from the JWT), so a role edit or a deactivated user takes
 * effect on the next request instead of waiting for the token to expire.
 *
 * A user with no `roleId` is a full administrator — that is how every account
 * that existed before RBAC was introduced keeps working unchanged.
 */
export async function getAccess(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { appRole: true },
  });
  if (!user || !user.isActive) throw new ApiError(401, 'Invalid or expired session');

  // Outlets this user is limited to ([] = every outlet).
  const allowedOutletIds = user.outletIds || [];

  if (!user.roleId || !user.appRole) {
    return { isSuperAdmin: true, roleId: null, roleName: 'Administrator', permissions: {}, allowedOutletIds };
  }
  if (!user.appRole.isActive) {
    return {
      isSuperAdmin: false, roleId: user.roleId, roleName: user.appRole.name, permissions: {}, allowedOutletIds,
    };
  }
  return {
    isSuperAdmin: false,
    roleId: user.roleId,
    roleName: user.appRole.name,
    permissions: normalizePermissions(user.appRole.permissions),
    allowedOutletIds,
  };
}

export function can(access, key, action = 'view') {
  return access.isSuperAdmin || hasPermission(access.permissions, key, action);
}
