import { useCallback, useMemo } from 'react';
import { useAppSelector } from '../app/hooks';
import { selectCurrentUser } from '../features/auth/authSlice';
import { hasPermission } from '../features/permissions/permissionCatalog';

/**
 * What the signed-in user may do, from the role + matrix the backend sent at
 * login (and refreshes via GET /auth/me — see useAccessSync).
 *
 *   const { can } = usePermissions();
 *   can('supplier')            // may open Supplier?
 *   can('supplier', 'delete')  // may delete suppliers?
 *
 * `can` also accepts a group key ('sales', 'reports'): true when any of its
 * sub-menus allows the action. Full administrators (no role) can do anything.
 * A session saved before RBAC existed has no access info yet; it is treated as
 * full access until /auth/me answers (the server enforces the real rules).
 */
export function usePermissions() {
  const user = useAppSelector(selectCurrentUser);

  const isLegacySession = Boolean(user) && user.isSuperAdmin === undefined && user.permissions === undefined;
  const isSuperAdmin = Boolean(user) && (isLegacySession || user.isSuperAdmin === true);
  const permissions = user?.permissions;

  const can = useCallback(
    (key, action = 'view') => isSuperAdmin || hasPermission(permissions, key, action),
    [isSuperAdmin, permissions],
  );

  return useMemo(
    () => ({ can, isSuperAdmin, roleName: user?.roleName }),
    [can, isSuperAdmin, user?.roleName],
  );
}
