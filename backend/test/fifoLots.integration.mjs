// Integration test: FIFO lot billing end to end with the 3-lot scenario
//   Lot  MRP  Purchase  Selling  Qty
//   B1   600  500       590       5
//   B2   650  550       640      10
//   B3   680  580       670      20
//
// Runs the REAL express app against a real Postgres and writes throwaway rows,
// so it REFUSES to run unless DATABASE_URL is a LOCAL database (never Azure).
//   DATABASE_URL=postgresql://postgres@localhost:5432/nexora_test npx prisma migrate deploy
//   DATABASE_URL=... npm run test:fifo-lots-db
import 'dotenv/config';
import assert from 'node:assert/strict';
import http from 'node:http';

if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL || '')) {
  console.error('Refusing to run: DATABASE_URL must point at a LOCAL test database (localhost / 127.0.0.1).');
  process.exit(2);
}
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-123';
process.env.NODE_ENV = 'test';

const { app } = await import('../src/app.js');
const { prisma } = await import('../src/config/prisma.js');
const jwt = (await import('jsonwebtoken')).default;

const server = http.createServer(app);
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/api`;

let passed = 0;
const failures = [];
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`  ok   ${name}`); } catch (e) { failures.push(name); console.log(`  FAIL ${name}\n       ${e.message}`); }
}

const suffix = Date.now().toString(36);
const tenant = await prisma.tenant.create({ data: { name: `F-${suffix}`, slug: `f-${suffix}` } });
const outlet = await prisma.outlet.create({ data: { tenantId: tenant.id, code: 'A', name: 'Outlet A' } });
const token = jwt.sign(
  { id: 'u1', tenantId: tenant.id, username: 'u1', name: 'Tester', role: 'ADMIN', outletId: outlet.id },
  process.env.JWT_SECRET,
);
const api = async (method, path, body) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json, data: json.data };
};

// Product with 35 units in three purchase lots, oldest first.
const product = await prisma.product.create({
  data: { tenantId: tenant.id, code: 'FIFO1', name: 'FIFO item', group: 'G', uom: 'PCS', salePrice: 590, mrp: 600, availableQty: 35 },
});
const t0 = Date.now() - 3 * 86400000;
const mkLot = (no, daysAfter, mrp, cost, price, qty) => prisma.productLot.create({
  data: {
    tenantId: tenant.id, productId: product.id, lotNo: no, receivedAt: new Date(t0 + daysAfter * 86400000),
    mrp, purchasePrice: cost, sellingPrice: price, qtyReceived: qty, qtyRemaining: qty,
  },
});
const B1 = await mkLot('B1', 0, 600, 500, 590, 5);
const B2 = await mkLot('B2', 1, 650, 550, 640, 10);
const B3 = await mkLot('B3', 2, 680, 580, 670, 20);

const n = (v) => Number(v);
const remaining = async () => Object.fromEntries(
  (await prisma.productLot.findMany({ where: { productId: product.id } })).map((l) => [l.lotNo, n(l.qtyRemaining)]),
);
const sell = (qty, extra = {}) => api('POST', '/sales', {
  customerName: 'Walk-in Customer', cashierName: 'c1', lines: [{ productId: product.id, qty }],
  paymentMethod: 'cash', receivedAmount: 100000, ...extra,
});
const linesOf = (sale) => prisma.tczPos1.findMany({ where: { docEntry: BigInt(sale.id) }, orderBy: { lineId: 'asc' } });

console.log('\nFIFO lot billing - integration tests');

let bill7;
await test('1. selling 7 splits into 2 bill lines: 5 from B1 @590 and 2 from B2 @640', async () => {
  const r = await sell(7);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  bill7 = r.data;
  const lines = await linesOf(bill7);
  assert.equal(lines.length, 2);
  assert.deepEqual(lines.map((l) => [n(l.quantity), n(l.price), n(l.unitCost), l.lotId]), [
    [5, 590, 500, B1.id], [2, 640, 550, B2.id],
  ]);
  // sub total 5*590 + 2*640 = 4230, GST 5% -> 4441.50
  assert.equal(n(bill7.subTotal), 4230);
  assert.equal(n(bill7.grandTotal), 4441.5);
});

await test('2. lots and product stock moved: B1 empty, B2 8 left, product total 28', async () => {
  assert.deepEqual(await remaining(), { B1: 0, B2: 8, B3: 20 });
  assert.equal((await prisma.product.findUnique({ where: { id: product.id } })).availableQty, 28);
});

await test('3. product price/MRP now show the next lot (B2: 640 / 650)', async () => {
  const p = await prisma.product.findUnique({ where: { id: product.id } });
  assert.equal(n(p.salePrice), 640); assert.equal(n(p.mrp), 650);
});

await test('4. next bill of 3 comes from B2 only', async () => {
  const r = await sell(3);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const lines = await linesOf(r.data);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].lotId, B2.id); assert.equal(n(lines[0].price), 640);
  assert.deepEqual(await remaining(), { B1: 0, B2: 5, B3: 20 });
});

await test('5. returning 2 of the B1 units puts them back into B1 (not B3)', async () => {
  const look = await api('GET', `/sales-returns/lookup/${bill7.billNo}`);
  assert.equal(look.status, 200, JSON.stringify(look.body));
  const b1Line = look.data.items[0];
  const ret = await api('POST', '/sales-returns', {
    saleId: bill7.id, items: [{ saleLineId: b1Line.saleLineId, qty: 2 }], reason: 'damaged', refundMode: 'refund', refundTo: 'cash',
  });
  assert.equal(ret.status, 201, JSON.stringify(ret.body));
  assert.deepEqual(await remaining(), { B1: 2, B2: 5, B3: 20 });
  // B1 is the oldest lot with stock again, so it is the price shown/sold next.
  assert.equal(n((await prisma.product.findUnique({ where: { id: product.id } })).salePrice), 590);
});

await test('6. selling more than the stock is rejected and changes nothing', async () => {
  const before = await remaining();
  const r = await sell(500);
  assert.equal(r.status, 400, JSON.stringify(r.body));
  assert.deepEqual(await remaining(), before);
});

await test('7. Gross Profit uses each line\'s own lot cost', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const r = await api('GET', `/gross-profit?from=${today}&to=${today}`);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const row = r.data.rows.find((x) => x.code === 'FIFO1');
  // bill of 7: cost 5*500 + 2*550 = 3600; bill of 3: cost 3*550 = 1650 -> 5250
  assert.equal(row.cost, 5250);
});

server.close();
await prisma.$disconnect();
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log(failures.map((f) => ` - ${f}`).join('\n')); process.exit(1); }
process.exit(0);
