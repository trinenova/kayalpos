import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReport, istDay, rangeBounds, eachDay, isCountedBill,
} from './salesReports.aggregate.js';
import { reportQuerySchema, reportParamsSchema } from './salesReports.schema.js';

const D = (s) => new Date(s);

// Bill 1: 2026-11-12 IST. subTotal 200, discount 20, tax 9 -> 189.
// Bill 2: 18:45Z on 12 Nov == 00:15 IST on 13 Nov (IST day boundary).
// Bill 3: cancelled. Bill 4: on hold. Bill 5: Canceled NULL (must count).
const bills = [
  {
    id: '1', outletId: 'o1', customerId: 'c1', customerName: 'Anu', cashier: 'Ravi', createdAt: D('2026-11-12T05:00:00Z'),
    canceled: 'N', hold: 'N', subTotal: 200, discount: 20, tax: 9, grandTotal: 189,
    lines: [
      { productId: 'p1', itemCode: 'P1', itemName: 'Oil', qty: 1, lineTotal: 100, taxValue: 4.5 },
      { productId: 'p2', itemCode: 'P2', itemName: 'Rice', qty: 2, lineTotal: 100, taxValue: 4.5 },
    ],
  },
  {
    id: '2', outletId: 'o2', customerId: 'w', customerName: 'Walk-in Customer', cashier: 'Mala', createdAt: D('2026-11-12T18:45:00Z'),
    canceled: 'N', hold: 'N', subTotal: 50, discount: 0, tax: 2.5, grandTotal: 52.5,
    lines: [{ productId: 'p1', itemCode: 'P1', itemName: 'Oil', qty: 1, lineTotal: 50, taxValue: 2.5 }],
  },
  {
    id: '3', outletId: 'o1', customerId: 'c1', cashier: 'Ravi', createdAt: D('2026-11-12T06:00:00Z'),
    canceled: 'Y', hold: 'N', subTotal: 999, discount: 0, tax: 0, grandTotal: 999, lines: [],
  },
  {
    id: '4', outletId: 'o1', customerId: 'c1', cashier: 'Ravi', createdAt: D('2026-11-12T06:30:00Z'),
    canceled: 'N', hold: 'Y', subTotal: 888, discount: 0, tax: 0, grandTotal: 888, lines: [],
  },
  {
    id: '5', outletId: null, customerId: null, customerName: null, cashier: null, createdAt: D('2026-11-14T05:00:00Z'),
    canceled: null, hold: null, subTotal: 10, discount: 0, tax: 0, grandTotal: 10,
    lines: [{ productId: 'p9', itemCode: 'P9', itemName: 'Mystery', qty: 1, lineTotal: 10, taxValue: 0 }],
  },
];
const returns = [{
  outletId: 'o1', customerId: 'c1', customerName: 'Anu', cashier: 'Ravi', createdAt: D('2026-11-13T05:00:00Z'), grandTotal: 52.5,
  items: [{ productId: 'p1', code: 'P1', name: 'Oil', qty: 1, amount: 50, taxRate: 0.05 }],
}];
const productMeta = new Map([
  ['p1', { id: 'p1', code: 'P1', name: 'Oil', group: 'Grocery', brand: 'Gold' }],
  ['p2', { id: 'p2', code: 'P2', name: 'Rice', group: 'Grocery', brand: null }],
]);
const outlets = new Map([['o1', { name: 'Main', code: 'O1' }], ['o2', { name: 'Branch', code: 'O2' }]]);
const customers = new Map([['c1', { name: 'Anu', code: 'C1', mobile: '9' }], ['w', { name: 'Walk-in Customer', code: 'W', mobile: '' }]]);
const base = {
  from: '2026-11-12', to: '2026-11-14', bills, returns, productMeta, outlets, customers,
};
const run = (r, extra = {}) => buildReport(r, { ...base, ...extra });

test('IST day bucketing handles the midnight boundary', () => {
  assert.equal(istDay(D('2026-11-12T18:29:59Z')), '2026-11-12');
  assert.equal(istDay(D('2026-11-12T18:30:00Z')), '2026-11-13');
  const { start, end } = rangeBounds('2026-11-12', '2026-11-12');
  assert.equal(start.toISOString(), '2026-11-11T18:30:00.000Z');
  assert.equal(end.toISOString(), '2026-11-12T18:29:59.999Z');
});

test('cancelled and held bills are excluded, NULL flags are counted', () => {
  assert.equal(isCountedBill(bills[2]), false);
  assert.equal(isCountedBill(bills[3]), false);
  assert.equal(isCountedBill(bills[4]), true);
  const r = run('daily');
  assert.equal(r.summary.bills, 3);
  assert.equal(r.summary.sales, 251.5);
});

test('daily: groups by IST date, nets returns on the return date, zero-fills the chart', () => {
  const r = run('daily');
  assert.deepEqual(r.rows.map((x) => x.key), ['2026-11-12', '2026-11-13', '2026-11-14']);
  const d12 = r.rows[0]; const d13 = r.rows[1];
  assert.equal(d12.sales, 189); assert.equal(d12.bills, 1);
  assert.equal(d13.sales, 52.5); assert.equal(d13.returns, 52.5); assert.equal(d13.net, 0);
  assert.equal(r.series.length, 3);
  assert.equal(r.summary.net, 251.5 - 52.5);
  assert.equal(r.summary.avgBill, Math.round((251.5 / 3) * 100) / 100);
});

test('daily chart series fills days with no sales', () => {
  const r = buildReport('daily', { ...base, from: '2026-11-10', to: '2026-11-14' });
  assert.equal(r.series.length, 5);
  assert.equal(r.series[0].sales, 0);
  assert.equal(r.rows.length, 3); // table only lists days that had activity
});

test('monthly groups by YYYY-MM', () => {
  const r = run('monthly');
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].key, '2026-11');
  assert.equal(r.rows[0].sales, 251.5);
});

test('outlet: names resolved, unassigned bucket, share adds to ~100', () => {
  const r = run('outlet');
  const labels = r.rows.map((x) => x.label);
  assert.ok(labels.includes('Main') && labels.includes('Branch') && labels.includes('No outlet'));
  const main = r.rows.find((x) => x.label === 'Main');
  assert.equal(main.sales, 189); assert.equal(main.returns, 52.5); assert.equal(main.net, 136.5);
  const total = r.rows.reduce((s, x) => s + x.share, 0);
  assert.ok(Math.abs(total - 100) < 0.1, `share sum ${total}`);
});

test('cashier: null cashier is reported as Unknown, returns follow the processing cashier', () => {
  const r = run('cashier');
  assert.ok(r.rows.some((x) => x.label === 'Unknown cashier'));
  assert.equal(r.rows.find((x) => x.label === 'Ravi').returns, 52.5);
});

test('customer: registered customers and walk-in grouped, null name falls back', () => {
  const r = run('customer');
  const anu = r.rows.find((x) => x.label === 'Anu');
  assert.equal(anu.sales, 189); assert.equal(anu.returns, 52.5); assert.equal(anu.code, 'C1');
  assert.ok(r.rows.some((x) => x.label === 'Walk-in Customer'));
});

test('item: apportions bill discount, adds line tax, subtracts returned value incl. tax', () => {
  const r = run('item');
  const oil = r.rows.find((x) => x.code === 'P1');
  // bill1 oil: 100 - (20*100/200)=90 +4.5 = 94.5 ; bill2 oil: 50 + 2.5 = 52.5  => 147
  assert.equal(oil.sales, 147);
  assert.equal(oil.qty, 2);
  assert.equal(oil.returnQty, 1);
  assert.equal(oil.returns, 52.5);
  assert.equal(oil.net, 94.5);
  assert.equal(oil.category, 'Grocery'); assert.equal(oil.brand, 'Gold');
  assert.equal(oil.bills, 2);
  // Item totals reconcile with bill totals.
  const tot = r.rows.reduce((s, x) => s + x.sales, 0);
  assert.ok(Math.abs(tot - 251.5) < 0.01);
});

test('category and brand: uncategorized / no brand buckets; bill counted once in summary', () => {
  const c = run('category');
  assert.ok(c.rows.some((x) => x.label === 'Grocery'));
  assert.ok(c.rows.some((x) => x.label === 'Uncategorized')); // product p9 unknown
  assert.equal(c.summary.bills, 3); // bill 1 spans two items but counts once
  const b = run('brand');
  assert.ok(b.rows.some((x) => x.label === 'Gold'));
  assert.ok(b.rows.some((x) => x.label === 'No brand'));
});

test('search filters rows and summary follows the filtered rows', () => {
  const r = run('item', { search: 'oil' });
  assert.equal(r.rows.length, 1);
  assert.equal(r.summary.sales, 147);
});

test('empty data gives zeros, not NaN', () => {
  const r = buildReport('daily', { from: '2026-11-12', to: '2026-11-12', bills: [], returns: [] });
  assert.equal(r.summary.sales, 0); assert.equal(r.summary.avgBill, 0); assert.equal(r.summary.net, 0);
  assert.equal(r.rows.length, 0); assert.equal(r.series.length, 1);
  ['item', 'category', 'brand', 'customer', 'outlet', 'cashier', 'monthly'].forEach((t) => {
    const x = buildReport(t, { from: '2026-11-12', to: '2026-11-12', bills: [], returns: [] });
    assert.equal(x.summary.sales, 0);
  });
});

test('returns with no matching sale in range still show against their key', () => {
  const r = buildReport('daily', { from: '2026-11-13', to: '2026-11-13', bills: [], returns });
  assert.equal(r.rows[0].returns, 52.5); assert.equal(r.rows[0].net, -52.5);
});

test('query schema: range validation', () => {
  assert.ok(reportQuerySchema.safeParse({ from: '2026-11-01', to: '2026-11-13' }).success);
  assert.ok(!reportQuerySchema.safeParse({ from: '2026-11-13', to: '2026-11-01' }).success);
  assert.ok(!reportQuerySchema.safeParse({ from: '2025-01-01', to: '2026-11-01' }).success);
  assert.ok(!reportQuerySchema.safeParse({ from: '13-11-2026' }).success);
  assert.ok(reportQuerySchema.safeParse({}).success);
  assert.ok(!reportParamsSchema.safeParse({ report: 'hourly' }).success);
  assert.equal(eachDay('2026-02-27', '2026-03-02').length, 4);
});

// ---- randomized reconciliation + performance ------------------------------
function rng(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

function makeData(n, seed = 7) {
  const rand = rng(seed);
  const products = new Map();
  for (let i = 0; i < 40; i += 1) products.set(`p${i}`, { id: `p${i}`, code: `P${i}`, name: `Item ${i}`, group: i % 5 ? `G${i % 5}` : null, brand: i % 3 ? `B${i % 3}` : null });
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const lines = [];
    const k = 1 + Math.floor(rand() * 4);
    let sub = 0; let taxSum = 0;
    for (let j = 0; j < k; j += 1) {
      const qty = 1 + Math.floor(rand() * 5); const price = 10 + Math.floor(rand() * 90);
      const lineTotal = qty * price;
      lines.push({ productId: `p${Math.floor(rand() * 40)}`, itemCode: 'x', itemName: 'x', qty, lineTotal, taxValue: 0 });
      sub += lineTotal;
    }
    const discount = rand() < 0.3 ? Math.round(sub * 0.1 * 100) / 100 : 0;
    // tax apportioned the same way the app does (5% of taxable)
    const taxable = sub - discount;
    lines.forEach((l) => { l.taxValue = (l.lineTotal / sub) * taxable * 0.05; taxSum += l.taxValue; });
    out.push({
      id: String(i), outletId: `o${i % 3}`, customerId: i % 4 ? `c${i % 50}` : null, customerName: 'Walk-in Customer',
      cashier: `u${i % 5}`, createdAt: new Date(Date.UTC(2026, 10, 1 + (i % 28), (i * 7) % 24, (i * 13) % 60)),
      canceled: i % 17 === 0 ? 'Y' : 'N', hold: 'N', subTotal: sub, discount, tax: taxSum, grandTotal: taxable + taxSum, lines,
    });
  }
  return { bills: out, productMeta: products };
}

test('every report reconciles to the same total sales (random data)', () => {
  const { bills, productMeta } = makeData(3000);
  const counted = bills.filter(isCountedBill);
  const expected = counted.reduce((s, b) => s + b.grandTotal, 0);
  const types = ['daily', 'monthly', 'outlet', 'cashier', 'customer', 'item', 'category', 'brand'];
  types.forEach((t) => {
    const r = buildReport(t, {
      from: '2026-11-01', to: '2026-12-05', bills, returns: [], productMeta,
    });
    const rowSum = r.rows.reduce((s, x) => s + x.sales, 0);
    assert.ok(Math.abs(rowSum - expected) < 1, `${t}: rows ${rowSum} vs bills ${expected}`);
    assert.ok(Math.abs(r.summary.sales - expected) < 1, `${t}: summary`);
    assert.equal(r.summary.bills, counted.length, `${t}: distinct bills`);
    const share = r.rows.reduce((s, x) => s + x.share, 0);
    assert.ok(Math.abs(share - 100) < 0.5 + r.rows.length * 0.01, `${t}: share ${share}`);
  });
});

test('aggregating 50,000 bills stays fast', () => {
  const { bills, productMeta } = makeData(50000, 11);
  const t0 = Date.now();
  ['daily', 'item', 'category'].forEach((t) => buildReport(t, {
    from: '2026-11-01', to: '2026-12-05', bills, returns: [], productMeta,
  }));
  const ms = Date.now() - t0;
  assert.ok(ms < 3000, `took ${ms}ms`);
});

test('summary bill count is distinct even when a search matches several rows of one bill', () => {
  // bill 1 has Oil + Rice; searching a category/brand shared by both must not double count it
  const r = buildReport('item', { ...base, search: 'i' }); // matches "Oil"/"Rice"? only Oil has 'i'; use brand
  const c = buildReport('category', { ...base, search: 'Gro' });
  assert.equal(c.rows.length, 1);
  assert.equal(c.summary.bills, 2); // bills 1 and 2, not 3
  assert.ok(!('billIds' in c.rows[0]));
  assert.ok(r.summary.bills >= 1);
});
