import { prisma } from '../../config/prisma.js';
import { broadcast } from './notification.hub.js';

const RETENTION_DAYS = 30;

/**
 * Create a notification and push it over the WebSocket. Never throws — a
 * failed notification must not break the business operation that caused it.
 * Returns the row, or null (duplicate / failure).
 */
export async function notify({
  tenantId, type, category, severity = 'info', title, message = null, link = null, dedupeKey = null, createdBy = null, outletId = null,
}) {
  try {
    const row = await prisma.notification.create({
      data: { tenantId, type, category, severity, title, message, link, dedupeKey, createdBy, outletId },
    });
    broadcast(tenantId, { type: 'notification', notification: row }, outletId);
    return row;
  } catch (err) {
    if (err?.code !== 'P2002') console.error('[notifications] create failed:', err.message);
    return null;
  }
}

// Outlets a user is limited to ([] = all), read fresh so access changes apply.
export async function allowedOutletsOf(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { outletIds: true } });
  return u?.outletIds || [];
}

// Tenant-wide events (no outlet) are visible to everyone; outlet events only
// to users with access to that outlet.
const visibleTo = (tenantId, userId, allowed = []) => ({
  tenantId,
  createdAt: { gte: new Date(Date.now() - RETENTION_DAYS * 86_400_000) },
  states: { none: { userId, dismissedAt: { not: null } } },
  ...(allowed.length ? { OR: [{ outletId: null }, { outletId: { in: allowed } }] } : {}),
});

export async function listForUser(tenantId, userId, { limit = 30, unreadOnly = false } = {}) {
  const allowed = await allowedOutletsOf(userId);
  const where = visibleTo(tenantId, userId, allowed);
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: unreadOnly ? { ...where, states: { none: { userId } } } : where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 30, 100),
      include: { states: { where: { userId }, select: { readAt: true } } },
    }),
    prisma.notification.count({ where: { ...where, states: { none: { userId } } } }),
  ]);
  return {
    unreadCount,
    items: rows.map(({ states, ...n }) => ({ ...n, read: states.length > 0 })),
  };
}

export async function markRead(tenantId, userId, id) {
  const n = await prisma.notification.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!n) return;
  await prisma.notificationState.upsert({
    where: { notificationId_userId: { notificationId: id, userId } },
    create: { notificationId: id, userId, readAt: new Date() },
    update: { readAt: new Date() },
  });
}

export async function markAllRead(tenantId, userId) {
  const rows = await prisma.notification.findMany({
    where: { ...visibleTo(tenantId, userId, await allowedOutletsOf(userId)), states: { none: { userId } } },
    select: { id: true },
  });
  if (!rows.length) return;
  await prisma.notificationState.createMany({
    data: rows.map((r) => ({ notificationId: r.id, userId, readAt: new Date() })),
    skipDuplicates: true,
  });
}

export async function clearAll(tenantId, userId) {
  const rows = await prisma.notification.findMany({ where: visibleTo(tenantId, userId, await allowedOutletsOf(userId)), select: { id: true } });
  if (!rows.length) return;
  const ids = rows.map((r) => r.id);
  const now = new Date();
  await prisma.notificationState.createMany({
    data: ids.map((id) => ({ notificationId: id, userId, readAt: now, dismissedAt: now })),
    skipDuplicates: true,
  });
  await prisma.notificationState.updateMany({
    where: { userId, notificationId: { in: ids } },
    data: { dismissedAt: now },
  });
}

/** Housekeeping: drop notifications past retention (called opportunistically). */
export async function purgeOld() {
  try {
    await prisma.notification.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 86_400_000) } },
    });
  } catch { /* ignore */ }
}
