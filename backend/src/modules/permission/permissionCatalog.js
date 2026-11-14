/**
 * Permission catalog — the single description of every menu that can be
 * granted in a Role's permission matrix, plus the pure helpers that edit a
 * permissions object. The backend keeps an identical copy at
 * backend/src/modules/permission/permissionCatalog.js (it has no imports, so
 * the two files are byte-for-byte the same) — change both together.
 *
 * A role's `permissions` is a plain object keyed by LEAF menu key:
 *   { 'line-sale': { view: true, add: true, edit: false, delete: false }, ... }
 * Groups (Masters, Sales, ...) are never stored: their checkboxes are derived
 * from / applied to their children. "All" is likewise derived (every action
 * the menu supports is ticked), so it is never stored either.
 */

export const ACTIONS = ['view', 'add', 'edit', 'delete'];
export const ACTION_LABELS = { view: 'View', add: 'Add', edit: 'Edit', delete: 'Delete' };

const VIEW_ONLY = ['view'];
const CRUD = ['view', 'add', 'edit', 'delete'];

const leaf = (key, label, actions = CRUD) => ({ key, label, actions });

export const MENU_TREE = [
  leaf('management-dashboard', 'Dashboard', VIEW_ONLY),
  {
    key: 'masters',
    label: 'Masters',
    children: [
      leaf('company', 'Company'),
      leaf('outlet', 'Outlet'),
      leaf('warehouse', 'Warehouse'),
      leaf('product', 'Product'),
      leaf('brand', 'Brand'),
      leaf('item-group', 'Item Group'),
      leaf('uom', 'UoM'),
      leaf('tax-code', 'Tax Code'),
      leaf('hsn-sac', 'HSN / SAC'),
      leaf('selling-price', 'Selling Price'),
      leaf('price-list', 'Price List'),
      leaf('batch-serial', 'Batch / Serial'),
      leaf('supplier', 'Supplier'),
      leaf('employee', 'Employee'),
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    children: [
      leaf('promotion', 'Promotion'),
      leaf('gift-voucher', 'Gift Voucher'),
      leaf('loyalty', 'Loyalty'),
      leaf('customer', 'Customer'),
    ],
  },
  {
    key: 'sales',
    label: 'Sales',
    children: [
      leaf('line-sale', 'Line Sale'),
      leaf('sales-quotation', 'Sales Quotation'),
      leaf('sales-order', 'Sales Order'),
      leaf('sales-return', 'Sales Return'),
      leaf('sales-invoice', 'Sales Invoice'),
      leaf('day-close', 'Day Close'),
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    children: [
      leaf('barcode-label', 'Barcode & Label'),
      leaf('stock-indent', 'Stock Indent'),
      leaf('stock-transfer', 'Stock Transfer'),
      leaf('stock-receipt', 'Stock Receipt'),
      leaf('stock-return', 'Stock Return'),
      leaf('stock-wastage', 'Stock Wastage'),
      leaf('stock-count', 'Stock Count'),
    ],
  },
  {
    key: 'synchronization',
    label: 'Synchronization',
    children: [
      leaf('master-sync', 'Master Sync', ['view', 'edit']),
      leaf('stock-sync', 'Stock Sync', ['view', 'edit']),
      leaf('sap-sync', 'SAP Sync', ['view', 'edit']),
    ],
  },
  leaf('cashier-panel', 'Cashier Panel'),
  leaf('expenses-book', 'Expense Book'),
  {
    key: 'reports',
    label: 'Reports',
    children: [
      leaf('reports-sales', 'Sales Reports', VIEW_ONLY),
      leaf('reports-inventory', 'Inventory Reports', VIEW_ONLY),
      leaf('reports-purchase', 'Purchase Reports', VIEW_ONLY),
      leaf('reports-cashier', 'Cashier Reports', VIEW_ONLY),
      leaf('reports-financial', 'Financial Reports', VIEW_ONLY),
      leaf('reports-sap', 'SAP Reports', VIEW_ONLY),
    ],
  },
  leaf('user-management', 'User Management'),
];

/** key -> node (group or leaf), and every leaf in display order. */
export const NODE_BY_KEY = {};
export const LEAVES = [];
MENU_TREE.forEach((node) => {
  NODE_BY_KEY[node.key] = node;
  if (node.children) {
    node.children.forEach((child) => {
      NODE_BY_KEY[child.key] = child;
      LEAVES.push(child);
    });
  } else {
    LEAVES.push(node);
  }
});

export const isGroup = (key) => Boolean(NODE_BY_KEY[key]?.children);

/** Leaf keys a key stands for: itself for a leaf, its children for a group. */
export function leafKeysOf(key) {
  const node = NODE_BY_KEY[key];
  if (!node) return [];
  return node.children ? node.children.map((c) => c.key) : [node.key];
}

export function emptyPermissions() {
  return {};
}

const flag = (perms, key, action) => Boolean(perms?.[key]?.[action]);

/** view implies nothing else; add/edit/delete require view. */
export function setLeafAction(perms, key, action, checked) {
  const node = NODE_BY_KEY[key];
  if (!node || node.children || !node.actions.includes(action)) return perms;
  const next = { ...(perms[key] || {}) };
  next[action] = checked;
  if (action === 'view' && !checked) node.actions.forEach((a) => { next[a] = false; });
  if (action !== 'view' && checked && node.actions.includes('view')) next.view = true;
  return { ...perms, [key]: next };
}

/** Tick / untick every action the leaf supports (the row's "All" box). */
export function setLeafAll(perms, key, checked) {
  const node = NODE_BY_KEY[key];
  if (!node || node.children) return perms;
  const next = {};
  node.actions.forEach((a) => { next[a] = checked; });
  return { ...perms, [key]: next };
}

/** Apply one action to a leaf, a whole group (its children), or — key=null — every leaf. */
export function setAction(perms, key, action, checked) {
  const keys = key ? leafKeysOf(key) : LEAVES.map((l) => l.key);
  return keys.reduce((acc, k) => setLeafAction(acc, k, action, checked), perms);
}

export function setAll(perms, key, checked) {
  const keys = key ? leafKeysOf(key) : LEAVES.map((l) => l.key);
  return keys.reduce((acc, k) => setLeafAll(acc, k, checked), perms);
}

function tri(values) {
  if (!values.length) return 'na';
  if (values.every(Boolean)) return 'all';
  if (values.some(Boolean)) return 'some';
  return 'none';
}

/** 'na' | 'none' | 'some' | 'all' for one action over a leaf / group / everything (key=null). */
export function actionState(perms, key, action) {
  const keys = key ? leafKeysOf(key) : LEAVES.map((l) => l.key);
  const supporting = keys.filter((k) => NODE_BY_KEY[k].actions.includes(action));
  return tri(supporting.map((k) => flag(perms, k, action)));
}

/** Same, for the "All" column: every supported action ticked. */
export function allState(perms, key) {
  const keys = key ? leafKeysOf(key) : LEAVES.map((l) => l.key);
  const cells = keys.flatMap((k) => NODE_BY_KEY[k].actions.map((a) => flag(perms, k, a)));
  return tri(cells);
}

/** Drop unknown keys / unsupported actions; coerce to booleans; enforce "needs view". */
export function normalizePermissions(raw) {
  const out = {};
  LEAVES.forEach((node) => {
    const src = raw?.[node.key];
    if (!src) return;
    const entry = {};
    node.actions.forEach((a) => { entry[a] = src[a] === true; });
    if (node.actions.some((a) => entry[a])) {
      if (node.actions.includes('view')) entry.view = true;
      out[node.key] = entry;
    }
  });
  return out;
}

/** Can the permissions object perform `action` on a leaf — or, for a group, on any of its leaves? */
export function hasPermission(perms, key, action = 'view') {
  return leafKeysOf(key).some((k) => flag(perms, k, action));
}

/** Route prefix -> menu key, longest prefix wins. Routes with no entry (home, settings) are open. */
export const ROUTE_MENU_KEYS = [
  ['/dashboard', 'management-dashboard'],
  ['/masters/company', 'company'],
  ['/masters/outlet', 'outlet'],
  ['/masters/warehouse', 'warehouse'],
  ['/masters/product', 'product'],
  ['/masters/brand', 'brand'],
  ['/masters/item-group', 'item-group'],
  ['/masters/uom', 'uom'],
  ['/masters/tax-code', 'tax-code'],
  ['/masters/hsn-sac', 'hsn-sac'],
  ['/masters/selling-price', 'selling-price'],
  ['/masters/price-list', 'price-list'],
  ['/masters/batch-serial', 'batch-serial'],
  ['/masters/supplier', 'supplier'],
  ['/masters/employee', 'employee'],
  ['/masters', 'masters'],
  ['/marketing', 'marketing'],
  ['/promotion', 'promotion'],
  ['/gift-voucher', 'gift-voucher'],
  ['/loyalty', 'loyalty'],
  ['/customer', 'customer'],
  ['/sales', 'sales'],
  ['/line-sale', 'line-sale'],
  ['/sales-quotation', 'sales-quotation'],
  ['/sales-order', 'sales-order'],
  ['/sales-return', 'sales-return'],
  ['/sales-invoice', 'sales-invoice'],
  ['/day-close', 'day-close'],
  ['/inventory', 'inventory'],
  ['/barcode-label', 'barcode-label'],
  ['/stock-indent', 'stock-indent'],
  ['/stock-transfer', 'stock-transfer'],
  ['/stock-receipt', 'stock-receipt'],
  ['/stock-return', 'stock-return'],
  ['/stock-wastage', 'stock-wastage'],
  ['/stock-count', 'stock-count'],
  ['/synchronization', 'synchronization'],
  ['/master-sync', 'master-sync'],
  ['/stock-sync', 'stock-sync'],
  ['/sap-sync', 'sap-sync'],
  ['/cashier-panel', 'cashier-panel'],
  ['/expenses-book', 'expenses-book'],
  ['/reports/sales', 'reports-sales'],
  ['/reports/inventory', 'reports-inventory'],
  ['/reports/purchase', 'reports-purchase'],
  ['/reports/cashier', 'reports-cashier'],
  ['/reports/financial', 'reports-financial'],
  ['/reports/sap', 'reports-sap'],
  ['/reports', 'reports'],
  ['/user-management', 'user-management'],
].sort((a, b) => b[0].length - a[0].length);

export function menuKeyForPath(pathname) {
  const hit = ROUTE_MENU_KEYS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return hit ? hit[1] : null;
}
