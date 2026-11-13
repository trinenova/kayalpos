// Unit test + worked example for FIFO lot billing (no database needed).
//   npm run test:fifo-lots
//
// Scenario (same product bought three times at different prices):
//   Lot  MRP  Purchase  Selling  Qty
//   B1   600  500       590       5
//   B2   650  550       640      10
//   B3   680  580       670      20
import assert from 'node:assert/strict';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://x@localhost:5432/x'; // never connects
const { splitFifo } = await import('../src/modules/product-lot/productLot.service.js');

const fresh = () => [
  { id: 'B1', lotNo: 'B1', qtyRemaining: 5, sellingPrice: 590, mrp: 600, purchasePrice: 500 },
  { id: 'B2', lotNo: 'B2', qtyRemaining: 10, sellingPrice: 640, mrp: 650, purchasePrice: 550 },
  { id: 'B3', lotNo: 'B3', qtyRemaining: 20, sellingPrice: 670, mrp: 680, purchasePrice: 580 },
];
const product = { salePrice: 700, mrp: 710 };

// Applies a sale to the lots like the server does (decrement what was taken).
function sell(lots, qty) {
  const parts = splitFifo(lots, qty, product);
  parts.forEach((p) => { if (p.lot) p.lot.qtyRemaining -= p.qty; });
  const sales = parts.reduce((s, p) => s + p.qty * p.price, 0);
  const cost = parts.reduce((s, p) => s + p.qty * (p.cost ?? 0), 0);
  return {
    parts: parts.map((p) => `${p.qty} x ${p.price} from ${p.lot ? p.lot.id : 'no lot'}`),
    sales,
    cost,
    profit: sales - cost,
  };
}

let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log(`  ok   ${name}`); };
console.log('\nFIFO lots - unit tests');

test('3 units come only from the oldest lot (B1)', () => {
  const r = sell(fresh(), 3);
  assert.deepEqual(r.parts, ['3 x 590 from B1']);
  assert.equal(r.sales, 1770); assert.equal(r.cost, 1500); assert.equal(r.profit, 270);
});

test('7 units split: 5 from B1 then 2 from B2', () => {
  const r = sell(fresh(), 7);
  assert.deepEqual(r.parts, ['5 x 590 from B1', '2 x 640 from B2']);
  assert.equal(r.sales, 5 * 590 + 2 * 640); // 4230
  assert.equal(r.cost, 5 * 500 + 2 * 550); // 3600
  assert.equal(r.profit, 630);
});

test('B1 is exhausted after 5, so the next bill starts on B2', () => {
  const lots = fresh();
  sell(lots, 5);
  assert.equal(lots[0].qtyRemaining, 0);
  const r = sell(lots, 4);
  assert.deepEqual(r.parts, ['4 x 640 from B2']);
});

test('two bills in a row consume lots in order (3 then 4 -> B1 3, B1 2 + B2 2)', () => {
  const lots = fresh();
  assert.deepEqual(sell(lots, 3).parts, ['3 x 590 from B1']);
  assert.deepEqual(sell(lots, 4).parts, ['2 x 590 from B1', '2 x 640 from B2']);
  assert.deepEqual(lots.map((l) => l.qtyRemaining), [0, 8, 20]);
});

test('all 35 units walk through B1, B2, B3', () => {
  const r = sell(fresh(), 35);
  assert.deepEqual(r.parts, ['5 x 590 from B1', '10 x 640 from B2', '20 x 670 from B3']);
  assert.equal(r.profit, 5 * 90 + 10 * 90 + 20 * 90); // every lot earns 90/unit
});

test('quantity beyond all lots is sold last at the product price with no cost', () => {
  const r = sell(fresh(), 37);
  assert.equal(r.parts.at(-1), '2 x 700 from no lot');
});

test('weighted average price shown in the cart equals the split total', () => {
  const parts = splitFifo(fresh(), 7, product);
  const avg = parts.reduce((s, p) => s + p.qty * p.price, 0) / 7;
  assert.ok(Math.abs(avg * 7 - 4230) < 1e-9);
});

console.log(`\n${passed} passed`);
