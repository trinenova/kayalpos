import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { createRoleSchema, updateRoleSchema } from './role.schema.js';

// Mounted behind authorize('user-management') in app.js.
const router = Router();

const toDto = (role) => ({
  id: role.id,
  name: role.name,
  description: role.description || '',
  isActive: role.isActive,
  permissions: role.permissions || {},
  userCount: role._count?.users ?? 0,
  createdAt: role.createdAt,
  updatedAt: role.updatedAt,
});

function mapWriteError(err) {
  if (err?.code === 'P2002') return new ApiError(409, 'A role with that name already exists');
  return err;
}

router.get('/', async (req, res, next) => {
  try {
    const rows = await prisma.role.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true } } },
    });
    res.json({ success: true, data: rows.map(toDto) });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const role = await prisma.role.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new ApiError(404, 'Role not found');
    res.json({ success: true, data: toDto(role) });
  } catch (err) { next(err); }
});

router.post('/', validateRequest(createRoleSchema), async (req, res, next) => {
  try {
    const role = await prisma.role.create({
      data: { ...req.body, tenantId: req.user.tenantId, createdBy: req.user.name },
      include: { _count: { select: { users: true } } },
    });
    res.status(201).json({ success: true, data: toDto(role) });
  } catch (err) { next(mapWriteError(err)); }
});

router.put('/:id', validateRequest(updateRoleSchema), async (req, res, next) => {
  try {
    const existing = await prisma.role.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId } });
    if (!existing) throw new ApiError(404, 'Role not found');
    const role = await prisma.role.update({
      where: { id: existing.id },
      data: { ...req.body, updatedBy: req.user.name },
      include: { _count: { select: { users: true } } },
    });
    res.json({ success: true, data: toDto(role) });
  } catch (err) { next(mapWriteError(err)); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const role = await prisma.role.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new ApiError(404, 'Role not found');
    if (role._count.users > 0) {
      throw new ApiError(409, `This role is assigned to ${role._count.users} user(s). Reassign them before deleting it`);
    }
    await prisma.role.delete({ where: { id: role.id } });
    res.json({ success: true, data: { id: role.id } });
  } catch (err) { next(err); }
});

export default router;
