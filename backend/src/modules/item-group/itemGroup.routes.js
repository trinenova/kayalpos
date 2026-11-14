import { prisma } from '../../config/prisma.js';
import { createCrudRouter } from '../../utils/crudFactory.js';
import { createItemGroupSchema, updateItemGroupSchema } from './itemGroup.schema.js';

const router = createCrudRouter({
  model: prisma.itemGroup,
  createSchema: createItemGroupSchema,
  updateSchema: updateItemGroupSchema,
  searchFields: ['code', 'name'],
  codePrefix: 'IG',
});

export default router;
