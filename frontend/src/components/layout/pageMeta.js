import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';

import { ALL_NAV_ITEMS } from './navConfig';
import { MASTER_ITEMS } from '../../modules/masters/mastersMockData';
import { INVENTORY_REPORT_DEFINITIONS } from '../../modules/reports/inventory/inventoryReportDefinitions';
import { CASHIER_REPORT_DEFINITIONS } from '../../modules/reports/cashier/cashierReportDefinitions';
import { SALES_REPORT_DEFINITIONS } from '../../modules/reports/sales/salesReportDefinitions';

// /reports/inventory/:reportKey, /reports/cashier/:reportKey and
// /reports/sales/:reportKey are dynamic routes (InventoryReportDetailPage.jsx
// / CashierReportDetailPage.jsx / SalesReportDetailPage.jsx), so they can't
// go in OVERRIDES like every other report sub-page — this maps the same
// report definitions those pages already read from straight to a tab
// label, keyed by the URL segment right after /reports/<category>.
const REPORT_DETAIL_DEFINITIONS = {
  inventory: INVENTORY_REPORT_DEFINITIONS,
  cashier: CASHIER_REPORT_DEFINITIONS,
  sales: SALES_REPORT_DEFINITIONS,
};

const NAV_BY_PATH = Object.fromEntries(ALL_NAV_ITEMS.map((item) => [item.path, item]));
const MASTER_BY_PATH = Object.fromEntries(MASTER_ITEMS.map((item) => [item.path, item]));

// Suffix labels for the transactional modules' status/overview/create
// sub-routes (e.g. /sales-order/pending, /sales-order/create), keyed by the
// module's own nav path so the tab reads "<Module> - <Status>" etc.
const STATUS_LABELS = {
  overview: (label) => `${label} Overview`,
  create: (label) => `Create ${label}`,
  draft: (label) => `${label} - Draft`,
  pending: (label) => `${label} - Pending`,
  confirmed: (label) => `${label} - Confirmed`,
  delivered: (label) => `${label} - Delivered`,
  sent: (label) => `${label} - Sent`,
  paid: (label) => `${label} - Paid`,
  overdue: (label) => `${label} - Overdue`,
  converted: (label) => `${label} - Converted`,
  expired: (label) => `${label} - Expired`,
  approved: (label) => `${label} - Approved`,
  rejected: (label) => `${label} - Rejected`,
  'pending-approval': (label) => `${label} - Pending Approval`,
  'pending-print': (label) => `${label} - Pending Print`,
  printed: (label) => `${label} - Printed`,
  'in-transit': (label) => `${label} - In Transit`,
  received: (label) => `${label} - Received`,
  cancelled: (label) => `${label} - Cancelled`,
};

// Explicit overrides for routes that don't live in NAV_SECTIONS or
// MASTER_ITEMS at all (Settings/Profile, "add" detail pages, and every
// Cashier Panel / Reports sub-page) — kept as one flat lookup instead of
// fuzzy-guessing labels from the URL.
const OVERRIDES = {
  '/customer/add': { label: 'Add Customer', icon: PersonAddAltOutlinedIcon },
  '/expenses-book/add': { label: 'Add Expense', icon: AddCircleOutlineOutlinedIcon },
  '/settings': { label: 'Settings', icon: SettingsOutlinedIcon },
  '/settings/profile': { label: 'Profile', icon: PersonOutlineOutlinedIcon },

  '/reports/sales': { label: 'Sales Reports', icon: BarChartOutlinedIcon },
  '/reports/inventory': { label: 'Inventory Reports', icon: BarChartOutlinedIcon },
  '/reports/purchase': { label: 'Purchase Reports', icon: BarChartOutlinedIcon },
  '/reports/cashier': { label: 'Cashier Reports', icon: BarChartOutlinedIcon },
  '/reports/cashier/shift-variance': { label: 'Shift-to-Shift Variance', icon: BarChartOutlinedIcon },
  '/reports/financial': { label: 'Financial Reports', icon: BarChartOutlinedIcon },
  '/reports/sap': { label: 'SAP Reports', icon: BarChartOutlinedIcon },

  '/cashier-panel/login': { label: 'Cashier Login', icon: LoginOutlinedIcon },
  '/cashier-panel/shift-opening': { label: 'Shift Opening', icon: ScheduleOutlinedIcon },
  '/cashier-panel/cash-sales': { label: 'Cash Sales', icon: PointOfSaleOutlinedIcon },
  '/cashier-panel/card-sales': { label: 'Card Sales', icon: CreditCardOutlinedIcon },
  '/cashier-panel/upi-sales': { label: 'UPI Sales', icon: QrCodeScannerOutlinedIcon },
  '/cashier-panel/other-payments': { label: 'Other Payments', icon: PaymentsOutlinedIcon },
  '/cashier-panel/cash-withdrawal': { label: 'Cash Withdrawal', icon: PaymentsOutlinedIcon },
  '/cashier-panel/cash-deposit': { label: 'Cash Deposit', icon: PaymentsOutlinedIcon },
  '/cashier-panel/cash-transfer': { label: 'Cash Transfer', icon: PaymentsOutlinedIcon },
  '/cashier-panel/cash-drawer-opening': { label: 'Cash Drawer Opening', icon: ScheduleOutlinedIcon },
  '/cashier-panel/shift-closing': { label: 'Shift Closing', icon: ScheduleOutlinedIcon },
  '/cashier-panel/cash-reconciliation': { label: 'Cash Reconciliation', icon: BalanceOutlinedIcon },
  '/cashier-panel/shortage-excess': { label: 'Shortage / Excess', icon: BalanceOutlinedIcon },
  '/cashier-panel/cashier-wise-sales': { label: 'Cashier Wise Sales', icon: ViewListOutlinedIcon },
};

/**
 * Resolves a route pathname to the {label, icon} shown on its open tab
 * (see TabBar.jsx / tabsSlice.js). Tries, in order: an explicit override, an
 * exact NAV_SECTIONS match, an exact MASTER_ITEMS match, then a prefix match
 * against NAV_SECTIONS for status/overview/create sub-routes of the
 * transactional modules (Sales Order, Stock Indent, etc.) — so every route
 * in App.jsx resolves to a sensible tab without hand-listing every single
 * one.
 *
 * `t` is react-i18next's translate function (pass the one from
 * `useTranslation()` in the calling component, e.g. TabBar.jsx) — nav items
 * only carry an i18next key (`labelKey` on NAV_SECTIONS entries, `i18nKey`
 * on MASTER_ITEMS) rather than a hardcoded label, since the sidebar/Masters
 * submenu translate into English/Tamil/Hindi. OVERRIDES below are sub-pages
 * outside that translated set and stay in English.
 */
export function getPageMeta(pathname, t) {
  if (OVERRIDES[pathname]) return OVERRIDES[pathname];
  if (NAV_BY_PATH[pathname]) return { label: t(NAV_BY_PATH[pathname].labelKey), icon: NAV_BY_PATH[pathname].icon };
  if (MASTER_BY_PATH[pathname]) {
    const item = MASTER_BY_PATH[pathname];
    return { label: t(`masters.${item.i18nKey}.label`), icon: item.icon };
  }

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length >= 2) {
    const parentPath = `/${segments[0]}`;
    const parentItem = NAV_BY_PATH[parentPath];
    const parentLabel = parentItem && t(parentItem.labelKey);
    const suffix = segments[segments.length - 1];
    if (parentItem && STATUS_LABELS[suffix]) {
      return { label: STATUS_LABELS[suffix](parentLabel), icon: parentItem.icon };
    }
    // /reports/inventory/:reportKey and /reports/cashier/:reportKey — look
    // up the real report name instead of falling through to the generic
    // "Reports" parent label below.
    if (segments[0] === 'reports' && segments.length === 3 && REPORT_DETAIL_DEFINITIONS[segments[1]]) {
      const definition = REPORT_DETAIL_DEFINITIONS[segments[1]][suffix];
      if (definition) return { label: definition.label, icon: definition.icon || BarChartOutlinedIcon };
    }
    // Dynamic /:module/edit/:id and /:module/view/:id detail routes — label
    // with the record's own id so each record's tab is distinguishable
    // (e.g. "Edit CUS-0001"), not just the module name repeated.
    if (parentItem && segments.length === 3 && (segments[1] === 'edit' || segments[1] === 'view')) {
      const verb = segments[1] === 'edit' ? 'Edit' : 'View';
      return { label: `${verb} ${segments[2]}`, icon: parentItem.icon };
    }
    if (parentItem) {
      // Unlisted sub-route of a known module — fall back to the module's
      // own label/icon rather than showing nothing.
      return { label: parentLabel, icon: parentItem.icon };
    }
  }

  const fallbackLabel = segments.length
    ? segments[segments.length - 1].split('-').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ')
    : 'Home';
  return { label: fallbackLabel, icon: HomeOutlinedIcon };
}

export const HOME_TAB_PATH = '/home';
