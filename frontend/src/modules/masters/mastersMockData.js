import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import StorefrontIcon from '@mui/icons-material/Storefront';
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import CardGiftcardOutlinedIcon from '@mui/icons-material/CardGiftcardOutlined';
import PlaylistAddCheckOutlinedIcon from '@mui/icons-material/PlaylistAddCheckOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CurrencyRupeeOutlinedIcon from '@mui/icons-material/CurrencyRupeeOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import NumbersOutlinedIcon from '@mui/icons-material/NumbersOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';

/**
 * TEMPORARY mock data for the Masters module. There's no unified Masters
 * backend module yet (each master — company, outlet, product, etc. —
 * belongs to its own API slice), so this static snapshot stands in for a
 * `useGetMastersMenuQuery()`. Replace with real API data once that module
 * exists — do not add more mock data here in the meantime.
 *
 * `label`/`description` are stored as i18next keys (`i18nKey`, resolved
 * under `masters.*` in src/i18n/locales/*.json); use `useMasterItems()`
 * below to get this list with translated `label`/`description` filled in.
 */

export const CASHIER = { name: 'Karthik', code: 'C001' };

export const MASTER_ITEMS = [
  { key: 'company', i18nKey: 'company', icon: SettingsOutlinedIcon, color: '#2563EB', path: '/masters/company' },
  { key: 'outlet', i18nKey: 'outlet', icon: StorefrontIcon, color: '#22A06B', path: '/masters/outlet' },
  { key: 'warehouse', i18nKey: 'warehouse', icon: MoveToInboxOutlinedIcon, color: '#8B5CF6', path: '/masters/warehouse' },
  { key: 'product', i18nKey: 'product', icon: Inventory2OutlinedIcon, color: '#F26B21', path: '/masters/product' },
  { key: 'brand', i18nKey: 'brand', icon: CardGiftcardOutlinedIcon, color: '#E5484D', path: '/masters/brand' },
  { key: 'item-group', i18nKey: 'itemGroup', icon: CategoryOutlinedIcon, color: '#2563EB', path: '/masters/item-group' },
  { key: 'uom', i18nKey: 'uom', icon: PlaylistAddCheckOutlinedIcon, color: '#0EA5A4', path: '/masters/uom' },
  { key: 'tax-code', i18nKey: 'taxCode', icon: ReceiptOutlinedIcon, color: '#F5A623', path: '/masters/tax-code' },
  { key: 'hsn-sac', i18nKey: 'hsnSac', icon: DescriptionOutlinedIcon, color: '#0EA5A4', path: '/masters/hsn-sac' },
  { key: 'selling-price', i18nKey: 'sellingPrice', icon: CurrencyRupeeOutlinedIcon, color: '#22A06B', path: '/masters/selling-price' },
  { key: 'price-list', i18nKey: 'priceList', icon: ReceiptLongOutlinedIcon, color: '#8B5CF6', path: '/masters/price-list' },
  { key: 'batch-serial', i18nKey: 'batchSerial', icon: NumbersOutlinedIcon, color: '#7C3AED', path: '/masters/batch-serial' },
  { key: 'supplier', i18nKey: 'supplier', icon: LocalShippingOutlinedIcon, color: '#F26B21', path: '/masters/supplier' },
  { key: 'employee', i18nKey: 'employee', icon: BadgeOutlinedIcon, color: '#0EA5A4', path: '/masters/employee' },
];

/** MASTER_ITEMS with `label`/`description` translated into the active language. */
export function useMasterItems() {
  const { t, i18n } = useTranslation();
  return useMemo(
    () => MASTER_ITEMS.map((item) => ({
      ...item,
      label: t(`masters.${item.i18nKey}.label`),
      description: t(`masters.${item.i18nKey}.description`),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  );
}
