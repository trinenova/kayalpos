import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { createUserSchema, updateUserSchema } from './user.schema.js';

// Mounted behind authorize('user-management') in app.js.
const router = Router();
const SALT_ROUNDS = 10;

// passwordHash / pinHash are never serialised.
const toDto = (user) => ({
  id: user.id,
  username: user.username,
  name: user.name,
  roleId: user.roleId,
  roleName: user.appRole?.name || 'Administrator',
  isActive: user.isActive,
  lastLogin: user.lastLogin,
  createdAt: user.createdAt,
});

const include = { appRole: { select: { name: true } } };

async function assertRoleBelongsToTenant(tenantId, roleId) {
  if (!roleId) return;
  const role = await prisma.role.findFirst({ where: { id: roleId, tenantId } });
  if (!role) throw new ApiError(400, 'Selected role does not exist');
}

function mapWriteError(err) {
  if (err?.code === 'P2002') return new ApiError(409, 'That username is already taken');
  return err;
}

router.get('/', async (req, res, next) => {
  try {
    const rows = await prisma.user.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: 'desc' },
      include,
    });
    res.json({ success: true, data: rows.map(toDto) });
  } catch (err) { next(err); }
});

router.post('/', validateRequest(createUserSchema), async (req, res, next) => {
  try {
    const { password, ...data } = req.body;
    await assertRoleBelongsToTenant(req.user.tenantId, data.roleId);
    const user = await prisma.user.create({
      data: {
        ...data,
        tenantId: req.user.tenantId,
        passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
        createdBy: req.user.name,
      },
      include,
    });
    res.status(201).json({ success: true, data: toDto(user) });
  } catch (err) { next(mapWriteError(err)); }
});

router.put('/:id', validateRequest(updateUserSchema), async (req, res, next) => {
  try {
    const existing = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId } });
    if (!existing) throw new ApiError(404, 'User not found');

    const { password, ...data } = req.body;
    // An admin can't lock themselves out by changing their own role or
    // deactivating their own account.
    if (existing.id === req.user.id) {
      if (!data.isActive) throw new ApiError(400, 'You cannot deactivate your own account');
      if ((data.roleId || null) !== (existing.roleId || null)) {
        throw new ApiError(400, 'You cannot change your own role');
      }
    }
    await assertRoleBelongsToTenant(req.user.tenantId, data.roleId);

    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        ...data,
        ...(password ? { passwordHash: await bcrypt.hash(password, SALT_ROUNDS) } : {}),
        updatedBy: req.user.name,
      },
      include,
    });
    res.json({ success: true, data: toDto(user) });
  } catch (err) { next(mapWriteError(err)); }
});

// Users are deactivated, never hard-deleted: they may be referenced by
// shifts, sales and audit columns.
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId } });
    if (!existing) throw new ApiError(404, 'User not found');
    if (existing.id === req.user.id) throw new ApiError(400, 'You cannot deactivate your own account');
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: { isActive: false, updatedBy: req.user.name },
      include,
    });
    res.json({ success: true, data: toDto(user) });
  } catch (err) { next(err); }
});

export default router;
