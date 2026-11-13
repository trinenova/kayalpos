/**
 * Config for the eight wired Sales Reports. `key` is the tile key / URL slug
 * (/reports/sales/:key), `api` is the backend report type, `kind` decides the
 * table's column set: 'bill' = one row per day/outlet/cashier/... (counts
 * bills), 'line' = one row per item/category/brand (counts item lines).
 */
export const SALES_REPORTS = {
  'daily-sales': {
    api: 'daily', kind: 'bill', title: 'Daily Sales', rowLabel: 'Date', chart: 'line',
    description: 'Sales summary for each day in the selected range.',
  },
  'monthly-sales': {
    api: 'monthly', kind: 'bill', title: 'Monthly Sales', rowLabel: 'Month', chart: 'bar',
    description: 'Sales summary for each month in the selected range.',
  },
  'outlet-wise-sales': {
    api: 'outlet', kind: 'bill', title: 'Outlet-wise Sales', rowLabel: 'Outlet', extra: 'code', extraLabel: 'Code', chart: 'bar',
    description: 'Compare sales performance across outlets.', search: true,
  },
  'cashier-wise-sales': {
    api: 'cashier', kind: 'bill', title: 'Cashier-wise Sales', rowLabel: 'Cashier', chart: 'bar',
    description: 'Sales performance of each cashier.', search: true,
  },
  'item-wise-sales': {
    api: 'item', kind: 'line', title: 'Item-wise Sales', rowLabel: 'Item Name', chart: 'bar',
    description: 'Quantity and value sold for each item.', search: true,
  },
  'category-wise-sales': {
    api: 'category', kind: 'line', title: 'Category-wise Sales', rowLabel: 'Category', chart: 'bar',
    description: 'Sales summary by product category (Product group).', search: true,
  },
  'brand-wise-sales': {
    api: 'brand', kind: 'line', title: 'Brand-wise Sales', rowLabel: 'Brand', chart: 'bar',
    description: 'Sales summary by brand.', search: true,
  },
  'customer-wise-sales': {
    api: 'customer', kind: 'bill', title: 'Customer-wise Sales', rowLabel: 'Customer', extra: 'mobile', extraLabel: 'Mobile', chart: 'bar',
    description: 'Sales summary by customer.', search: true,
  },
};

/** Today's date as YYYY-MM-DD in IST — the same business day the server uses. */
export function todayIso() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function addDays(iso, days) {
  const t = Date.parse(`${iso}T00:00:00Z`) + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

export function formatDisplayDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatMonth(ym) {
  const [y, m] = String(ym).split('-');
  return MONTHS[Number(m) - 1] ? `${MONTHS[Number(m) - 1]} ${y}` : ym;
}

/** Quick date presets for the filter bar. */
export function datePresets() {
  const today = todayIso();
  return [
    { label: 'Today', from: today, to: today },
    { label: 'Yesterday', from: addDays(today, -1), to: addDays(today, -1) },
    { label: 'Last 7 days', from: addDays(today, -6), to: today },
    { label: 'This month', from: `${today.slice(0, 7)}-01`, to: today },
    { label: 'Last 30 days', from: addDays(today, -29), to: today },
  ];
}

/** Row label as shown in the table / export (dates and months are formatted). */
export function rowLabel(config, row) {
  if (config.api === 'daily') return formatDisplayDate(row.date);
  if (config.api === 'monthly') return formatMonth(row.month);
  return row.label;
}
