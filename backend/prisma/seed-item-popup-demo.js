// Demo data for Line Sale's "Select item" popup.
// Run (from /backend):  npm run db:seed:popup
// Safe to re-run: products are upserted by code, demo lots are recreated.
// Everything is prefixed POPUP so it is easy to find and delete later.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

// lots: oldest first. Product qty = sum of lot qty (0 = out of stock).
const PRODUCTS = [
  // 1) SAME NAME, two products, no lots -> popup lists both
  { code: 'POPUP001', shortId: 'RICE1', name: 'Popup Sona Masoori Rice', packSize: '1kg', uom: 'KG', price: 70, mrp: 75, lots: [{ qty: 40, mrp: 75, cost: 60, price: 70, age: 10 }] },
  { code: 'POPUP002', shortId: 'RICE5', name: 'Popup Sona Masoori Rice', packSize: '5kg', uom: 'KG', price: 340, mrp: 360, lots: [{ qty: 12, mrp: 360, cost: 300, price: 340, age: 5 }] },

  // 2) ONE product, two lots (different qty / MRP / price) -> lots popup
  { code: 'POPUP003', shortId: 'SUG1', name: 'Popup Sugar 1kg', packSize: '1kg', uom: 'KG', price: 45, mrp: 50, lots: [
    { qty: 10, mrp: 50, cost: 38, price: 45, age: 20 },
    { qty: 25, mrp: 55, cost: 42, price: 50, age: 3 },
  ] },

  // 3) SAME NAME + lots, one of them out of stock -> both features together
  { code: 'POPUP004', shortId: 'TEA1', name: 'Popup Tea Powder', packSize: '250g', uom: 'PCS', price: 110, mrp: 120, lots: [
    { qty: 6, mrp: 120, cost: 90, price: 110, age: 15 },
    { qty: 18, mrp: 125, cost: 95, price: 115, age: 2 },
  ] },
  { code: 'POPUP005', shortId: 'TEA2', name: 'Popup Tea Powder', packSize: '500g', uom: 'PCS', price: 215, mrp: 230, lots: [] },

  // 4) CONTROL: one product, one lot -> NO popup, added straight away
  { code: 'POPUP006', shortId: 'SALT1', name: 'Popup Salt 1kg', packSize: '1kg', uom: 'KG', price: 20, mrp: 22, lots: [{ qty: 50, mrp: 22, cost: 15, price: 20, age: 7 }] },
];

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'kayal-agro-foods' } })
    || await prisma.tenant.findFirst();
  if (!tenant) throw new Error('No tenant found — run `npm run db:seed` first.');

  for (const p of PRODUCTS) {
    const total = p.lots.reduce((s, l) => s + l.qty, 0);
    const data = {
      name: p.name,
      shortId: p.shortId,
      group: 'Grocery',
      uom: p.uom,
      packSize: p.packSize,
      taxCode: 'GST@5%',
      taxGroup: 'Taxable',
      isGst: true,
      isInventoryItem: true,
      unitPrice: p.price,
      salePrice: p.price,
      mrp: p.mrp,
      availableQty: total,
      status: 'ACTIVE',
    };
    const product = await prisma.product.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: p.code } },
      update: data,
      create: { ...data, code: p.code, tenantId: tenant.id },
    });

    await prisma.productLot.deleteMany({ where: { tenantId: tenant.id, productId: product.id } });
    for (let i = 0; i < p.lots.length; i += 1) {
      const l = p.lots[i];
      await prisma.productLot.create({
        data: {
          tenantId: tenant.id,
          productId: product.id,
          lotNo: `${p.code}-L${i + 1}`,
          source: 'MANUAL',
          receivedAt: daysAgo(l.age),
          mrp: l.mrp,
          purchasePrice: l.cost,
          sellingPrice: l.price,
          qtyReceived: l.qty,
          qtyRemaining: l.qty,
        },
      });
    }
    console.log(`${p.code}  ${p.name} (${p.packSize})  stock ${total}  lots ${p.lots.length}`);
  }
  console.log('\nDone. Open Line Sale and search: "Popup Sona", "Popup Sugar", "Popup Tea", "Popup Salt".');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
