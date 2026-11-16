// Dev seed data: one Tenant, its Outlets, one Admin user, and a couple of
// sample Brands so the app isn't empty on first run.
//
// Run with: npx prisma db seed   (or it runs automatically after
// `npx prisma migrate dev` the first time you're prompted).
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'Admin@123'; // dev-only default — change it after first login
const SALT_ROUNDS = 10;

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'kayal-agro-foods' },
    update: {},
    create: { name: 'Sri Maruthamalai Andavar', slug: 'kayal-agro-foods' },
  });

  const outletNames = [
    { code: 'OUT001', name: 'SMA - Main Outlet' },
    { code: 'OUT002', name: 'SMA - Head Office' },
    { code: 'OUT003', name: 'SMA - Saravanampatti' },
    { code: 'OUT004', name: 'SMA - Peelamedu' },
    { code: 'OUT005', name: 'SMA - Singanallur' },
  ];

  for (const outlet of outletNames) {
    await prisma.outlet.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: outlet.code } },
      update: {},
      create: { ...outlet, tenantId: tenant.id },
    });
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);
  await prisma.user.upsert({
    where: { username: ADMIN_USERNAME },
    update: {},
    create: {
      tenantId: tenant.id,
      username: ADMIN_USERNAME,
      passwordHash,
      name: 'Admin',
      role: 'ADMIN',
    },
  });

  const brands = [
    { code: 'BR001', name: 'Aashirvaad', description: 'Aashirvaad brand products', category: 'Grocery' },
    { code: 'BR002', name: 'Tata', description: 'Tata brand products', category: 'Grocery' },
    { code: 'BR003', name: 'Nestle', description: 'Nestle brand products', category: 'Beverages' },
  ];

  for (const brand of brands) {
    await prisma.brand.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: brand.code } },
      update: {},
      create: { ...brand, tenantId: tenant.id, status: 'ACTIVE' },
    });
  }

  console.log('Seed complete.');
  console.log(`Login with username "${ADMIN_USERNAME}" / password "${ADMIN_PASSWORD}" — change this after first login.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
