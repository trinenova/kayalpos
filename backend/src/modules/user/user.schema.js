import { z } from 'zod';

const username = z.string().trim().min(3, 'Username must be at least 3 characters').max(50, 'Username cannot exceed 50 characters')
  .regex(/^[A-Za-z0-9._-]+$/, 'Use letters, numbers, dot, dash or underscore only');
const password = z.string().min(6, 'Password must be at least 6 characters').max(100);

// roleId null = full administrator (same as every pre-RBAC account).
export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  username,
  password,
  roleId: z.string().trim().min(1).nullable().default(null),
  isActive: z.boolean().default(true),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  username,
  // Blank / missing = keep the current password.
  password: z.union([password, z.literal('')]).optional(),
  roleId: z.string().trim().min(1).nullable().default(null),
  isActive: z.boolean().default(true),
});
