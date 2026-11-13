import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { createCrudRouter } from '../../utils/crudFactory.js';
import { createSupplierSchema, updateSupplierSchema } from './supplier.schema.js';
import { importSuppliers, importSuppliersSchema } from './supplier.import.js';

const crud = createCrudRouter({
  model: prisma.supplier,
  createSchema: createSupplierSchema,
  updateSchema: updateSupplierSchema,
  searchFields: ['code', 'name', 'email', 'phone'],
  codePrefix: 'SUPP',
});

const router = Router();

// Excel import (Masters > Supplier > Import). Declared before the CRUD router
// so '/import' is never mistaken for an id.
router.post('/import', requireAuth, validateRequest(importSuppliersSchema), async (req, res, next) => {
  try {
    const summary = await importSuppliers(req.user.tenantId, req.body.rows, req.user.name);
    crud.clearListCache();
    res.json({ success: true, data: summary });
  } catch (err) { next(err); }
});

router.use(crud);

export default router;
