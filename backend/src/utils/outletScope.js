// Outlet scoping for users limited to specific outlets (User Management >
// Outlet Access). `user.allowedOutletIds` is attached per request by
// middleware/authorize.js; an empty / missing list means "every outlet".

const allowedOf = (user) => (user?.allowedOutletIds?.length ? user.allowedOutletIds : null);

/** `{ id: { in: [...] } }` for Outlet queries — `{}` when unrestricted. */
export function outletIdFilter(user) {
  const allowed = allowedOf(user);
  return allowed ? { id: { in: allowed } } : {};
}

/** `{ AND: [{ id: { in: [...] } }] }` — safe to spread next to an existing `id` key. */
export function outletAnd(user) {
  const allowed = allowedOf(user);
  return allowed ? { AND: [{ id: { in: allowed } }] } : {};
}

/** `{ outletId: { in: [...] } }` for tables that carry an outletId column. */
export function outletFieldFilter(user) {
  const allowed = allowedOf(user);
  return allowed ? { outletId: { in: allowed } } : {};
}

export const isOutletAllowed = (user, outletId) => {
  const allowed = allowedOf(user);
  return !allowed || allowed.includes(outletId);
};
