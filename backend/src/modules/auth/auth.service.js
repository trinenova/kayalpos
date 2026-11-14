import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { getAccess } from '../permission/permission.service.js';

const SALT_ROUNDS = 10;

/**
 * Prisma-backed login: verifies the username/password against the User
 * table (bcrypt hash) and the selected outlet against the Outlet table,
 * then signs a JWT carrying the fields every downstream route needs
 * (tenantId for tenant-scoped queries, outletId for the session's active
 * outlet). Replaces the old devAuth.js hardcoded credential.
 */
export async function login({ username, password, outletId }) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.isActive) {
    throw new ApiError(401, 'Invalid username or password');
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new ApiError(401, 'Invalid username or password');
  }

  const outlet = await prisma.outlet.findFirst({
    where: { id: outletId, tenantId: user.tenantId, isActive: true },
  });
  if (!outlet) {
    throw new ApiError(400, 'Select a valid outlet');
  }

  // Users limited to specific outlets (User.outletIds) can only sign in to one
  // of them. An empty list means every outlet.
  if (user.outletIds?.length && !user.outletIds.includes(outlet.id)) {
    throw new ApiError(403, 'You are not assigned to this outlet. Select one of your outlets.');
  }

  const payload = {
    id: user.id,
    tenantId: user.tenantId,
    username: user.username,
    name: user.name,
    role: user.role,
    outletId: outlet.id,
  };

  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '12h' });

  const access = await getAccess(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

  return { user: { ...payload, ...access }, token };
}

/**
 * Switches the signed-in user's active outlet: validates it (same tenant,
 * active, and among the user's allowed outlets) and issues a fresh JWT whose
 * outletId every outlet-scoped route reads — so the top-bar switcher changes
 * what the server uses, not just what the screen shows.
 */
export async function switchOutlet({ userId, outletId }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) throw new ApiError(401, 'Invalid or expired session');

  const outlet = await prisma.outlet.findFirst({ where: { id: outletId, tenantId: user.tenantId, isActive: true } });
  if (!outlet) throw new ApiError(400, 'Select a valid outlet');
  if (user.outletIds?.length && !user.outletIds.includes(outlet.id)) {
    throw new ApiError(403, 'You are not assigned to this outlet.');
  }

  const payload = {
    id: user.id,
    tenantId: user.tenantId,
    username: user.username,
    name: user.name,
    role: user.role,
    outletId: outlet.id,
  };
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '12h' });
  const access = await getAccess(user.id);
  return { user: { ...payload, ...access }, token };
}

/** Current role + permissions for the signed-in user (frontend refreshes this on load). */
export async function getMe(userId) {
  return getAccess(userId);
}

/**
 * Verifies the current password against the authenticated user's stored
 * hash, then writes a new hash. `userId` comes from req.user (the decoded
 * JWT), never from the request body.
 */
export async function changePassword({ userId, currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(401, 'Authentication required');
  }

  const currentMatches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!currentMatches) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return { success: true };
}
