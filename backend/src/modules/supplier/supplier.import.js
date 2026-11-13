import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { createSupplierSchema } from './supplier.schema.js';

export const importSuppliersSchema = z.object({
  rows: z.array(z.record(z.any())).min(1, 'No rows to import').max(500, 'Import at most 500 rows per request'),
});

const CODE_PREFIX = 'SUPP';
const CODE_LENGTH = 4;

const issueText = (error) => {
  const flat = error.flatten();
  const parts = Object.entries(flat.fieldErrors).map(([field, msgs]) => `${field}: ${msgs.join(', ')}`);
  return [...flat.formErrors, ...parts].join('; ') || 'Invalid row';
};

/**
 * Excel import for Suppliers. Each row is validated with the same zod schema
 * the create form uses. A row matches an existing supplier by Supplier Code,
 * else GST No., else exact (case-insensitive) name; a match is updated (blank
 * cells never overwrite — they simply aren't sent), anything else is created
 * with the next SUPP#### code. Rows are independent: a bad row is reported
 * with its sheet row number and never blocks the others.
 */
export async function importSuppliers(tenantId, rows, actorName) {
  const existing = await prisma.supplier.findMany({ where: { tenantId }, select: { code: true } });
  let nextNumber = existing.reduce((max, s) => {
    const m = String(s.code).match(new RegExp(`^${CODE_PREFIX}-?(\\d+)$`));
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0) + 1;

  const summary = {
    total: rows.length, created: 0, updated: 0, failed: 0, errors: [],
  };
  const fail = (row, ref, message) => {
    summary.failed += 1;
    summary.errors.push({ row: row._row, ref, message });
  };

  for (const raw of rows) {
    const { _row, ...input } = raw;
    const parsed = createSupplierSchema.safeParse(input);
    if (!parsed.success) {
      fail(raw, input.code || input.name, issueText(parsed.error));
      continue; // eslint-disable-line no-continue
    }
    const data = parsed.data;

    try {
      let match = null;
      if (data.code) match = await prisma.supplier.findFirst({ where: { tenantId, code: data.code } });
      if (!match && data.gstNo) match = await prisma.supplier.findFirst({ where: { tenantId, gstNo: data.gstNo.toUpperCase() } });
      if (!match) match = await prisma.supplier.findFirst({ where: { tenantId, name: { equals: data.name, mode: 'insensitive' } } });

      if (match) {
        const { code, ...update } = data;
        // `status` always has a default in the schema; only apply it when the sheet had a Status column value.
        if (input.status === undefined) delete update.status;
        await prisma.supplier.update({ where: { id: match.id }, data: { ...update, updatedBy: actorName } });
        summary.updated += 1;
      } else {
        const code = data.code || `${CODE_PREFIX}${String(nextNumber).padStart(CODE_LENGTH, '0')}`;
        if (!data.code) nextNumber += 1;
        await prisma.supplier.create({
          data: { ...data, code, tenantId, createdBy: actorName },
        });
        summary.created += 1;
      }
    } catch (err) {
      fail(raw, data.code || data.name, err?.code === 'P2002' ? 'A supplier with that code already exists' : 'Failed to save row');
    }
  }
  return summary;
}
