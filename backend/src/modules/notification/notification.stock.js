import { prisma } from '../../config/prisma.js';
import { notify } from './notification.service.js';

const MAX_NEW_PER_RUN = 20;
const timers = new Map();

/** Debounced per tenant — a burst of writes triggers one check. */
export function scheduleStockCheck(tenantId) {
  if (timers.has(tenantId)) return;
  timers.set(tenantId, setTimeout(() => {
    timers.delete(tenantId);
    checkStock(tenantId).catch((err) => console.error('[notifications] stock check failed:', err.message));
  }, 1500));
}

/**
 * Raises "low stock" / "out of stock" alerts for products at or below their
 * reorder level. Each product alerts once per state (dedupeKey); when it is
 * restocked above the reorder level its alert row is removed so a later dip
 * alerts again.
 */
export async function checkStock(tenantId) {
  const low = await prisma.$queryRaw`
    SELECT "Id" AS id, "Name" AS name, "Code" AS code, "AvailableQty" AS qty, "ReorderLevel" AS reorder
    FROM "Product"
    WHERE "TenantId" = ${tenantId} AND "AvailableQty" <= "ReorderLevel"
    LIMIT 500`;

  const current = new Map(low.map((p) => [`stock:${p.id}:${Number(p.qty) <= 0 ? 'out' : 'low'}`, p]));

  const existing = await prisma.notification.findMany({
    where: { tenantId, dedupeKey: { startsWith: 'stock:' } },
    select: { id: true, dedupeKey: true },
  });
  const existingKeys = new Set(existing.map((e) => e.dedupeKey));

  const stale = existing.filter((e) => !current.has(e.dedupeKey)).map((e) => e.id);
  if (stale.length) await prisma.notification.deleteMany({ where: { id: { in: stale } } });

  let created = 0;
  for (const [key, p] of current) {
    if (existingKeys.has(key) || created >= MAX_NEW_PER_RUN) continue;
    const out = Number(p.qty) <= 0;
    // eslint-disable-next-line no-await-in-loop
    await notify({
      tenantId,
      type: out ? 'stock.out' : 'stock.low',
      category: 'sales',
      severity: out ? 'error' : 'warning',
      title: out ? 'Out of stock' : 'Low stock alert',
      message: `${p.name}${p.code ? ` (${p.code})` : ''} · ${Number(p.qty)} left, reorder level ${Number(p.reorder)}`,
      dedupeKey: key,
    });
    created += 1;
  }
}
