import { z } from 'zod';

// `code` is intentionally NOT required — the CRUD factory auto-generates it
// (IG0001, IG0002, ...) on create, same as Brand.
export const createItemGroupSchema = z.object({
  code: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1, 'Item group name is required').max(100, 'Name cannot exceed 100 characters'),
  description: z.string().trim().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const updateItemGroupSchema = createItemGroupSchema.partial();
