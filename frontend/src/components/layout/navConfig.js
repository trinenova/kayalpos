import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import AssignmentReturnOutlinedIcon from '@mui/icons-material/AssignmentReturnOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import CardGiftcardOutlinedIcon from '@mui/icons-material/CardGiftcardOutlined';
import FavoriteBorderOutlinedIcon from '@mui/icons-material/FavoriteBorderOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined';
import PlaylistAddCheckOutlinedIcon from '@mui/icons-material/PlaylistAddCheckOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import CloudSyncOutlinedIcon from '@mui/icons-material/CloudSyncOutlined';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import CloudQueueOutlinedIcon from '@mui/icons-material/CloudQueueOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';

import { usePermissions } from '../../hooks/usePermissions';
import { NODE_BY_KEY } from '../../features/permissions/permissionCatalog';

/**
 * Single source of truth for the sidebar + "Quick Access" grid on Home.
 * Every module tile in Home's Quick Access reuses this list instead of
 * duplicating labels/icons/routes, so the sidebar and the dashboard tiles
 * can never drift apart.
 *
 * `section` groups items visually (a divider is drawn between groups in the
 * sidebar), matching the spacing break seen in the reference between
 * "Stock Count" and "Cashier Panel".
 *
 * `color` is each item's unique icon color, shown when the "Sidebar Icon
 * Colors" toggle in Settings (see uiSlice.js's sidebarIconColorsEnabled) is
 * on; turning it off falls back to the sidebar's plain single-tone icons.
 *
 * Labels are stored as `labelKey` (an i18next key under `nav.*`, see
 * src/i18n/locales/*.json) rather than a hardcoded English string, so the
 * menu re-renders in whichever language is active. Use the `useNavSections`
 * / `useAllNavItems` / `useQuickAccessItems` hooks below to get the same
 * shape with a translated `label` filled in — don't read `label` off the
 * raw NAV_SECTIONS/ALL_NAV_ITEMS/QUICK_ACCESS_ITEMS constants directly.
 */
/**
 * Sub-modules grouped under the sidebar's "Marketing" menu. They no longer
 * have their own sidebar rows; /marketing shows them as tiles instead. They
 * stay in ALL_NAV_ITEMS (below) so tab titles, global search and Home's
 * Quick Access keep working, and their routes are unchanged.
 */
export const MARKETING_ITEMS = [
  { key: 'promotion', labelKey: 'nav.promotion', icon: CampaignOutlinedIcon, path: '/promotion', quickAccess: true, color: '#9D174D' },
  { key: 'gift-voucher', labelKey: 'nav.giftVoucher', icon: CardGiftcardOutlinedIcon, path: '/gift-voucher', quickAccess: true, color: '#86198F' },
  { key: 'loyalty', labelKey: 'nav.loyalty', icon: FavoriteBorderOutlinedIcon, path: '/loyalty', quickAccess: true, color: '#9F1239' },
  { key: 'customer', labelKey: 'nav.customer', icon: PeopleAltOutlinedIcon, path: '/customer', quickAccess: true, color: '#0369A1' },
];
const MARKETING_PATHS = MARKETING_ITEMS.map((item) => item.path);

/** Sub-modules under the sidebar's "Sales" menu (shown as tiles on /sales). */
export const SALES_ITEMS = [
  { key: 'line-sale', labelKey: 'nav.lineSale', icon: PointOfSaleOutlinedIcon, path: '/line-sale', quickAccess: true, color: '#C2410C' },
  { key: 'sales-quotation', labelKey: 'nav.salesQuotation', icon: DescriptionOutlinedIcon, path: '/sales-quotation', quickAccess: true, color: '#115E59' },
  { key: 'sales-order', labelKey: 'nav.salesOrder', icon: ReceiptLongOutlinedIcon, path: '/sales-order', quickAccess: true, color: '#065F46' },
  { key: 'sales-return', labelKey: 'nav.salesReturn', icon: AssignmentReturnOutlinedIcon, path: '/sales-return', quickAccess: true, color: '#991B1B' },
  { key: 'sales-invoice', labelKey: 'nav.salesInvoice', icon: ReceiptOutlinedIcon, path: '/sales-invoice', quickAccess: true, color: '#166534' },
  { key: 'day-close', labelKey: 'nav.dayClose', icon: EventAvailableOutlinedIcon, path: '/day-close', quickAccess: true, color: '#1D4ED8' },
];
const SALES_PATHS = SALES_ITEMS.map((item) => item.path);

/** Sub-modules under the sidebar's "Inventory" menu (shown as tiles on /inventory). */
export const INVENTORY_ITEMS = [
  { key: 'barcode-label', labelKey: 'nav.barcodeLabel', icon: QrCode2OutlinedIcon, path: '/barcode-label', quickAccess: true, color: '#3F6212' },
  { key: 'stock-indent', labelKey: 'nav.stockIndent', icon: PlaylistAddCheckOutlinedIcon, path: '/stock-indent', quickAccess: true, color: '#854D0E' },
  { key: 'stock-transfer', labelKey: 'nav.stockTransfer', icon: LocalShippingOutlinedIcon, path: '/stock-transfer', quickAccess: true, color: '#92400E' },
  { key: 'stock-receipt', labelKey: 'nav.stockReceipt', icon: MoveToInboxOutlinedIcon, path: '/stock-receipt', quickAccess: true, color: '#155E75' },
  { key: 'stock-return', labelKey: 'nav.stockReturn', icon: KeyboardReturnOutlinedIcon, path: '/stock-return', quickAccess: true, color: '#6B21A8' },
  { key: 'stock-wastage', labelKey: 'nav.stockWastage', icon: DeleteOutlineOutlinedIcon, path: '/stock-wastage', quickAccess: true, color: '#7F1D1D' },
  { key: 'stock-count', labelKey: 'nav.stockCount', icon: FactCheckOutlinedIcon, path: '/stock-count', quickAccess: true, color: '#3730A3' },
];
const INVENTORY_PATHS = INVENTORY_ITEMS.map((item) => item.path);

/** Sub-modules under the sidebar's "Synchronization" menu (shown as tiles on /synchronization). */
export const SYNC_ITEMS = [
  { key: 'master-sync', labelKey: 'nav.masterSync', icon: CloudDoneOutlinedIcon, path: '/master-sync', quickAccess: true, color: '#0C4A6E' },
  { key: 'stock-sync', labelKey: 'nav.stockSync', icon: CloudSyncOutlinedIcon, path: '/stock-sync', quickAccess: true, color: '#14532D' },
  { key: 'sap-sync', labelKey: 'nav.sapSync', icon: CloudQueueOutlinedIcon, path: '/sap-sync', quickAccess: true, color: '#4C1D95' },
];
const SYNC_PATHS = SYNC_ITEMS.map((item) => item.path);

export const NAV_SECTIONS = [
  {
    key: 'main',
    items: [
      { key: 'home', labelKey: 'nav.home', icon: HomeOutlinedIcon, path: '/home', color: '#1E40AF' },
      { key: 'management-dashboard', labelKey: 'nav.dashboard', icon: SpaceDashboardOutlinedIcon, path: '/dashboard', color: '#5B21B6' },
      { key: 'masters', labelKey: 'nav.masters', icon: SettingsOutlinedIcon, path: '/masters', color: '#1E293B' },
      { key: 'marketing', labelKey: 'nav.marketing', icon: StorefrontOutlinedIcon, path: '/marketing', color: '#9D174D', childPaths: MARKETING_PATHS },
      { key: 'sales', labelKey: 'nav.sales', icon: ShoppingCartOutlinedIcon, path: '/sales', color: '#C2410C', childPaths: SALES_PATHS },
      { key: 'inventory', labelKey: 'nav.inventory', icon: Inventory2OutlinedIcon, path: '/inventory', color: '#854D0E', childPaths: INVENTORY_PATHS },
      { key: 'synchronization', labelKey: 'nav.synchronization', icon: SyncOutlinedIcon, path: '/synchronization', color: '#0C4A6E', childPaths: SYNC_PATHS },
      { key: 'cashier-panel', labelKey: 'nav.cashierPanel', icon: BadgeOutlinedIcon, path: '/cashier-panel', quickAccess: true, color: '#78350F' },
      { key: 'expenses-book', labelKey: 'nav.expensesBook', icon: MenuBookOutlinedIcon, path: '/expenses-book', quickAccess: true, color: '#451A03' },
      { key: 'reports', labelKey: 'nav.reports', icon: BarChartOutlinedIcon, path: '/reports', color: '#1E3A8A' },
      {
        key: 'user-management', labelKey: 'nav.userManagement', defaultLabel: 'User Management', icon: AdminPanelSettingsOutlinedIcon, path: '/user-management', color: '#7F1D1D',
      },
    ],
  },
];

export const ALL_NAV_ITEMS = [...NAV_SECTIONS.flatMap((section) => section.items), ...MARKETING_ITEMS, ...SALES_ITEMS, ...INVENTORY_ITEMS, ...SYNC_ITEMS];

// Modules with a Quick Access tile on the Home page, in reference order.
export const QUICK_ACCESS_ITEMS = ALL_NAV_ITEMS.filter((item) => item.quickAccess);

function withTranslatedLabel(item, t) {
  return { ...item, label: t(item.labelKey, { defaultValue: item.defaultLabel }) };
}

// Home (and anything not in the permission catalog) is always visible; every
// catalogued menu needs `view` on it — for a group such as Sales, on any of
// its sub-menus.
const isVisible = (item, can) => !NODE_BY_KEY[item.key] || can(item.key, 'view');

/** NAV_SECTIONS with each item's `label` translated into the active language. */
export function useNavSections() {
  const { t, i18n } = useTranslation();
  const { can } = usePermissions();
  return useMemo(
    () => NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => isVisible(item, can)).map((item) => withTranslatedLabel(item, t)),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language, can],
  );
}

/** ALL_NAV_ITEMS with each item's `label` translated into the active language. */
export function useAllNavItems() {
  const { t, i18n } = useTranslation();
  const { can } = usePermissions();
  return useMemo(
    () => ALL_NAV_ITEMS.filter((item) => isVisible(item, can)).map((item) => withTranslatedLabel(item, t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language, can],
  );
}

/** QUICK_ACCESS_ITEMS with each item's `label` translated into the active language. */
export function useQuickAccessItems() {
  const { t, i18n } = useTranslation();
  const { can } = usePermissions();
  return useMemo(
    () => QUICK_ACCESS_ITEMS.filter((item) => isVisible(item, can)).map((item) => withTranslatedLabel(item, t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language, can],
  );
}
