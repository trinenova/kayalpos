import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import CompareArrowsOutlinedIcon from '@mui/icons-material/CompareArrowsOutlined';

/**
 * TEMPORARY mock data for the Cashier Reports screen. There's no Reports
 * backend module yet, so this static snapshot stands in for a
 * `useGetCashierReportsMenuQuery()`. Replace with real API data once that
 * module exists — do not add more mock data here in the meantime.
 */

export const CASHIER = { name: 'Karthik', code: 'C001' };

export const OUTLET_OPTIONS = [
  'Main Outlet', 'Head Office', 'Saravanampatti', 'Peelamedu', 'Singanallur',
];

export const CASHIER_OPTIONS = ['Karthik Kumar', 'Priya Shree', 'Sathish Kumar', 'Kavitha S'];

export const DEFAULT_DATE_RANGE = { from: '2026-05-26', to: '2026-05-26' };

export const CASHIER_REPORT_ITEMS = [
  { key: 'cashier-sales', label: 'Cashier Sales', description: 'View sales summary and details for individual cashiers.', icon: PersonOutlineOutlinedIcon, color: '#2563EB' },
  { key: 'shift-summary', label: 'Shift Summary', description: 'View shift-wise sales and performance summary.', icon: AccessTimeOutlinedIcon, color: '#22A06B' },
  { key: 'payment-collection', label: 'Payment Collection', description: 'View amount collected by cashiers during shifts, split by Cash, UPI and Card.', icon: PaidOutlinedIcon, color: '#F26B21' },
  { key: 'cash-shortage-excess', label: 'Cash Shortage / Excess', description: 'View shortage or excess amount recorded in cash handling.', icon: BalanceOutlinedIcon, color: '#E5484D' },
  { key: 'cash-drawer-report', label: 'Cash Drawer Report', description: 'View cash drawer opening, closing and transaction summary.', icon: PointOfSaleOutlinedIcon, color: '#7C3AED' },
  { key: 'payment-reconciliation', label: 'Payment Reconciliation', description: 'Reconcile payments received with sales transactions.', icon: FactCheckOutlinedIcon, color: '#0EA5A4' },
  { key: 'shift-variance', label: 'Shift-to-Shift Variance', description: 'Compare consecutive shifts: closing cash variance, handover differences and pending handovers.', icon: CompareArrowsOutlinedIcon, color: '#B45309', path: '/reports/cashier/shift-variance' },
];
