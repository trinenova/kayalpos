import { z } from 'zod';

// NOTE: outletId is accepted but not yet validated against a real Outlet
// table (the Outlet master module hasn't been built). It is passed through
// so the selected outlet can be echoed back and stored on the session once
// that module exists.
export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  outletId: z.string().trim().min(1, 'Outlet is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export const switchOutletSchema = z.object({
  outletId: z.string().trim().min(1, 'Outlet is required'),
});
