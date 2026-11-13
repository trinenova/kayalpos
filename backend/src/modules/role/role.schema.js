import { z } from 'zod';
import { normalizePermissions } from '../permission/permissionCatalog.js';

// `permissions` is whatever the matrix sent — it is run through
// normalizePermissions (unknown menus/actions dropped, add/edit/delete imply
// view) so the stored JSON can only ever contain valid catalog entries.
const roleBase = z.object({
  name: z.string().trim().min(1, 'Role name is required').max(80, 'Role name cannot exceed 80 characters'),
  description: z.string().trim().max(250, 'Description cannot exceed 250 characters').optional().nullable(),
  isActive: z.boolean().default(true),
  permissions: z.record(z.any()).default({}).transform((value) => normalizePermissions(value)),
});

export const createRoleSchema = roleBase;
export const updateRoleSchema = roleBase;
