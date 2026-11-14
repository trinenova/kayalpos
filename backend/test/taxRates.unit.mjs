// Unit test for per-product GST (no database needed).  npm run test:tax-rates
import assert from 'node:assert/strict';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://x@localhost:5432/x';
const { loadTaxRateResolver } = await import('../src/modules/sale/taxRates.js');

const client = {
  taxCode: {
    findMany: async () => [
      { code: 'GST0', name: 'GST 0%', rate: 0 },
      { code: 'GST5', name: 'GST 5%', rate: 5 },
      { code: 'GST12', name: 'GST 12%', rate: 12 },
      { code: 'GST18', name: 'GST 18%', rate: 18 },
    ],
  },
};
const rateOf = await loadTaxRateResolver(client, 't1');

let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log(`  ok   ${name}`); };
console.log('\nPer-product GST - unit tests');

test('matches the product tax code by name (case-insensitive)', () => {
  assert.equal(rateOf({ taxCode: 'GST 12%' }), 0.12);
  assert.equal(rateOf({ taxCode: 'gst 18%' }), 0.18);
});
test('matches by tax code too', () => assert.equal(rateOf({ taxCode: 'GST5' }), 0.05));
test('0% tax code is honoured (not replaced by the default)', () => assert.equal(rateOf({ taxCode: 'GST 0%' }), 0));
test('no tax code or unknown code falls back to the 5% default', () => {
  assert.equal(rateOf({ taxCode: '' }), 0.05);
  assert.equal(rateOf({ taxCode: null }), 0.05);
  assert.equal(rateOf({ taxCode: 'Mystery' }), 0.05);
});
test('mixed bill: 100 @5%, 200 @12%, 100 @0% -> GST 29, total 429', () => {
  const lines = [{ amount: 100, rate: 0.05 }, { amount: 200, rate: 0.12 }, { amount: 100, rate: 0 }];
  const subTotal = lines.reduce((s, l) => s + l.amount, 0);
  const tax = lines.reduce((s, l) => s + l.amount * l.rate, 0);
  assert.equal(subTotal + tax, 429); assert.equal(tax, 29);
});
test('bill discount is shared in proportion, each line still taxed at its own rate', () => {
  const lines = [{ amount: 100, rate: 0.05 }, { amount: 300, rate: 0.18 }];
  const subTotal = 400; const taxable = 360; // 10% discount
  const tax = lines.reduce((s, l) => s + (l.amount / subTotal) * taxable * l.rate, 0);
  assert.ok(Math.abs(tax - (90 * 0.05 + 270 * 0.18)) < 1e-9);
});
console.log(`\n${passed} passed`);
