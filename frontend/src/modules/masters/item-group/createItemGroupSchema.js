import { z } from 'zod';

export const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
];

// Mirrors the server's createItemGroupSchema (backend/src/modules/item-group).
// `code` isn't part of the form: the CRUD factory generates it (IG0001, ...).
export const createItemGroupSchema = z.object({
  name: z.string().trim().min(1, 'Item group name is required').max(100, 'Name cannot exceed 100 characters'),
  description: z.string().trim().optional(),
  status: z.string().trim().min(1, 'Select a status'),
});

export const createItemGroupDefaultValues = { name: '', description: '', status: 'Active' };

export function itemGroupToFormValues(row) {
  if (!row) return createItemGroupDefaultValues;
  return {
    name: row.name || '',
    description: row.description || '',
    status: String(row.status).toUpperCase() === 'INACTIVE' ? 'Inactive' : 'Active',
  };
}

export function itemGroupFormValuesToPayload(values) {
  return {
    name: values.name.trim(),
    description: values.description?.trim() || undefined,
    status: values.status === 'Inactive' ? 'INACTIVE' : 'ACTIVE',
  };
}
