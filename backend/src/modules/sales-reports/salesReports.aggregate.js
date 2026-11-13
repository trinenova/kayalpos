/**
 * Pure aggregation for the Sales Reports (no database access — the service
 * fetches rows and hands them here, which keeps every number unit-testable).
 *
 * Conventions
 *  - A bill's `grandTotal` is what the customer paid (subTotal − discount + tax).
 *  - Line `lineTotal` is price × qty BEFORE bill discount and tax, so a line's
 *    own discount is the bill discount apportioned by share of the bill's
 *    subTotal, and its sales value is lineTotal − discount + taxValue. Those
 *    line values add back up to the bill's grandTotal (up to rounding).
 *  - Returns reduce sales: net = sales − returns. A return is attributed to the
 *    day / cashier / outlet / customer it was PROCESSED against (return date,
 *    cashierName on the return, the original bill's outlet, the bill's customer).
 *  - Business dates use IST (Asia/Kolkata), the same zone bills are stamped in.
 */

export const TIME_ZONE = 'Asia/Kolkata';

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Date -> 'YYYY-MM-DD' in IST. */
export function istDay(date) {
  return dayFormat.format(new Date(date));
}

export const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const num = (v) => Number(v) || 0;

/** Inclusive instant bounds of an IST calendar range 'YYYY-MM-DD'..'YYYY-MM-DD'. */
export function rangeBounds(from, to) {
  return {
    start: new Date(`${from}T00:00:00.000+05:30`),
    end: new Date(`${to}T23:59:59.999+05:30`),
  };
}

/** Every 'YYYY-MM-DD' from..to inclusive. */
export function eachDay(from, to) {
  const out = [];
  let t = Date.parse(`${from}T00:00:00Z`);
  const last = Date.parse(`${to}T00:00:00Z`);
  while (t <= last) {
    out.push(new Date(t).toISOString().slice(0, 10));
    t += 86400000;
  }
  return out;
}

/** A bill counts as a sale unless it was cancelled or is still on hold. */
export function isCountedBill(bill) {
  return String(bill.canceled || '').toUpperCase() !== 'Y' && String(bill.hold || '').toUpperCase() !== 'Y';
}

const emptyBucket = () => ({
  bills: new Set(), qty: 0, gross: 0, discount: 0, tax: 0, sales: 0,
  returnCount: 0, returnQty: 0, returns: 0, lastSale: null,
});

function finishBucket(b) {
  const bills = b.bills.size;
  const sales = round2(b.sales);
  const returns = round2(b.returns);
  return {
    bills,
    qty: round2(b.qty),
    gross: round2(b.gross),
    discount: round2(b.discount),
    tax: round2(b.tax),
    sales,
    returnCount: b.returnCount,
    returnQty: round2(b.returnQty),
    returns,
    net: round2(sales - returns),
    avgBill: bills ? round2(sales / bills) : 0,
    lastSale: b.lastSale,
    // Stripped before the response is built; lets the summary
    // count DISTINCT bills across rows (a bill on 2 categories counts once).
    billIds: b.bills,
  };
}

/** Totals row over finished rows. */
function totalsOf(rows) {
  const t = rows.reduce((acc, r) => {
    acc.qty += r.qty; acc.gross += r.gross; acc.discount += r.discount; acc.tax += r.tax;
    acc.sales += r.sales; acc.returnCount += r.returnCount; acc.returnQty += r.returnQty; acc.returns += r.returns;
    return acc;
  }, {
    qty: 0, gross: 0, discount: 0, tax: 0, sales: 0, returnCount: 0, returnQty: 0, returns: 0,
  });
  return t;
}

const bump = (map, key, make) => {
  if (!map.has(key)) map.set(key, make());
  return map.get(key);
};

/**
 * Bill-level grouping (daily / monthly / outlet / cashier / customer).
 * `keyOfBill(bill)` / `keyOfReturn(ret)` return the group key; `labelOf(key)` the row fields.
 */
function groupByBill({ bills, returns, keyOfBill, keyOfReturn, describe }) {
  const groups = new Map();
  const meta = new Map();

  bills.forEach((bill) => {
    const key = keyOfBill(bill);
    const b = bump(groups, key, emptyBucket);
    meta.set(key, meta.get(key) || describe(key, bill, null));
    b.bills.add(bill.id);
    b.qty += (bill.lines || []).reduce((s, l) => s + num(l.qty), 0);
    b.gross += num(bill.subTotal);
    b.discount += num(bill.discount);
    b.tax += num(bill.tax);
    b.sales += num(bill.grandTotal);
    if (!b.lastSale || bill.createdAt > b.lastSale) b.lastSale = bill.createdAt;
  });

  returns.forEach((ret) => {
    const key = keyOfReturn(ret);
    const b = bump(groups, key, emptyBucket);
    meta.set(key, meta.get(key) || describe(key, null, ret));
    b.returnCount += 1;
    b.returnQty += (ret.items || []).reduce((s, i) => s + num(i.qty), 0);
    b.returns += num(ret.grandTotal);
  });

  return [...groups.entries()].map(([key, b]) => ({ key, ...meta.get(key), ...finishBucket(b) }));
}

/**
 * Line-level grouping (item / category / brand). Bills-count is the number of
 * DISTINCT bills a key appears on. Return lines carry qty and amount (ex-tax)
 * plus a taxRate, so the refunded value includes tax like a sale line does.
 */
function groupByLine({ bills, returns, productMeta, keyOfLine, describe }) {
  const groups = new Map();
  const meta = new Map();

  bills.forEach((bill) => {
    const subTotal = num(bill.subTotal);
    (bill.lines || []).forEach((line) => {
      const product = productMeta.get(line.productId) || null;
      const key = keyOfLine(line, product);
      const b = bump(groups, key, emptyBucket);
      meta.set(key, meta.get(key) || describe(key, line, product));
      const lineTotal = num(line.lineTotal);
      const lineDiscount = subTotal > 0 ? (num(bill.discount) * lineTotal) / subTotal : 0;
      const lineTax = num(line.taxValue);
      b.bills.add(bill.id);
      b.qty += num(line.qty);
      b.gross += lineTotal;
      b.discount += lineDiscount;
      b.tax += lineTax;
      b.sales += lineTotal - lineDiscount + lineTax;
      if (!b.lastSale || bill.createdAt > b.lastSale) b.lastSale = bill.createdAt;
    });
  });

  returns.forEach((ret) => {
    (ret.items || []).forEach((item) => {
      const product = productMeta.get(item.productId) || null;
      const key = keyOfLine(item, product);
      const b = bump(groups, key, emptyBucket);
      meta.set(key, meta.get(key) || describe(key, item, product));
      b.returnCount += 1;
      b.returnQty += num(item.qty);
      b.returns += num(item.amount) * (1 + num(item.taxRate));
    });
  });

  return [...groups.entries()].map(([key, b]) => ({ key, ...meta.get(key), ...finishBucket(b) }));
}

const UNASSIGNED = 'Unassigned';

/**
 * Builds a report.
 * @param {string} report one of REPORT_TYPES
 * @param {{from:string,to:string,bills:Array,returns:Array,productMeta:Map,outlets:Map,customers:Map,search?:string}} input
 */
export function buildReport(report, input) {
  const {
    from, to, returns, productMeta = new Map(), outlets = new Map(), customers = new Map(), search,
  } = input;
  const bills = input.bills.filter(isCountedBill);
  const pctSort = (a, b) => b.sales - a.sales || b.net - a.net || String(a.label).localeCompare(String(b.label));
  let rows;
  let columns;

  switch (report) {
    case 'daily':
      rows = groupByBill({
        bills,
        returns,
        keyOfBill: (b) => istDay(b.createdAt),
        keyOfReturn: (r) => istDay(r.createdAt),
        describe: (key) => ({ label: key, date: key }),
      }).sort((a, b) => a.key.localeCompare(b.key));
      columns = 'bill';
      break;
    case 'monthly':
      rows = groupByBill({
        bills,
        returns,
        keyOfBill: (b) => istDay(b.createdAt).slice(0, 7),
        keyOfReturn: (r) => istDay(r.createdAt).slice(0, 7),
        describe: (key) => ({ label: key, month: key }),
      }).sort((a, b) => a.key.localeCompare(b.key));
      columns = 'bill';
      break;
    case 'outlet':
      rows = groupByBill({
        bills,
        returns,
        keyOfBill: (b) => b.outletId || UNASSIGNED,
        keyOfReturn: (r) => r.outletId || UNASSIGNED,
        describe: (key) => {
          const o = outlets.get(key);
          return { label: o?.name || (key === UNASSIGNED ? 'No outlet' : key), code: o?.code || '' };
        },
      }).sort(pctSort);
      columns = 'bill';
      break;
    case 'cashier':
      rows = groupByBill({
        bills,
        returns,
        keyOfBill: (b) => b.cashier || UNASSIGNED,
        keyOfReturn: (r) => r.cashier || UNASSIGNED,
        describe: (key) => ({ label: key === UNASSIGNED ? 'Unknown cashier' : key }),
      }).sort(pctSort);
      columns = 'bill';
      break;
    case 'customer':
      rows = groupByBill({
        bills,
        returns,
        keyOfBill: (b) => b.customerId || `name:${b.customerName || 'Walk-in Customer'}`,
        keyOfReturn: (r) => r.customerId || `name:${r.customerName || 'Walk-in Customer'}`,
        describe: (key, bill, ret) => {
          const c = customers.get(key);
          return {
            label: c?.name || bill?.customerName || ret?.customerName || 'Walk-in Customer',
            code: c?.code || '',
            mobile: c?.mobile || bill?.customerMobile || '',
          };
        },
      }).sort(pctSort);
      columns = 'bill';
      break;
    case 'item':
      rows = groupByLine({
        bills,
        returns,
        productMeta,
        keyOfLine: (l) => l.productId || `code:${l.itemCode || l.code}`,
        describe: (key, l, p) => ({
          label: l.itemName || l.name || p?.name || '',
          code: l.itemCode || l.code || p?.code || '',
          category: p?.group || '',
          brand: p?.brand || '',
          uom: l.uom || p?.uom || '',
        }),
      }).sort(pctSort);
      columns = 'line';
      break;
    case 'category':
      rows = groupByLine({
        bills,
        returns,
        productMeta,
        keyOfLine: (l, p) => (p?.group || 'Uncategorized'),
        describe: (key) => ({ label: key }),
      }).sort(pctSort);
      columns = 'line';
      break;
    case 'brand':
      rows = groupByLine({
        bills,
        returns,
        productMeta,
        keyOfLine: (l, p) => (p?.brand || 'No brand'),
        describe: (key) => ({ label: key }),
      }).sort(pctSort);
      columns = 'line';
      break;
    default:
      throw new Error(`Unknown report ${report}`);
  }

  const term = String(search || '').trim().toLowerCase();
  if (term) {
    rows = rows.filter((r) => [r.label, r.code, r.mobile, r.category, r.brand]
      .some((v) => String(v || '').toLowerCase().includes(term)));
  }

  const totals = totalsOf(rows);
  // Distinct bills across ALL rows (a bill spanning two categories counts once
  // in the summary even though it appears in both category rows).
  const distinct = new Set();
  rows.forEach((r) => r.billIds.forEach((id) => distinct.add(id)));
  const totalBills = distinct.size;

  const share = (v) => (totals.sales > 0 ? round2((v / totals.sales) * 100) : 0);
  rows = rows.map(({ billIds, ...r }) => ({ ...r, share: share(r.sales) }));

  const summary = {
    bills: totalBills,
    qty: round2(totals.qty),
    gross: round2(totals.gross),
    discount: round2(totals.discount),
    tax: round2(totals.tax),
    sales: round2(totals.sales),
    returnCount: totals.returnCount,
    returns: round2(totals.returns),
    net: round2(totals.sales - totals.returns),
    avgBill: totalBills ? round2(totals.sales / totalBills) : 0,
  };

  // Daily gets a zero-filled series so the trend chart has no gaps.
  let series = rows.map((r) => ({ label: r.label, sales: r.sales, net: r.net }));
  if (report === 'daily') {
    const byDay = new Map(rows.map((r) => [r.key, r]));
    series = eachDay(from, to).map((d) => ({
      label: d, sales: byDay.get(d)?.sales || 0, net: byDay.get(d)?.net || 0,
    }));
  }

  return { report, from, to, columns, summary, rows, series };
}
