import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import StorefrontIcon from '@mui/icons-material/Storefront';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import PercentOutlinedIcon from '@mui/icons-material/PercentOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';

/**
 * TEMPORARY mock data for the Sales Reports screen. There's no Reports
 * backend module yet, so this static snapshot stands in for a
 * `useGetSalesReportsMenuQuery()`. Replace with real API data once that
 * module exists — do not add more mock data here in the meantime.
 */

export const CASHIER = { name: 'Karthik', code: 'C001' };

export const OUTLET_OPTIONS = [
  'Main Outlet', 'Head Office', 'Saravanampatti', 'Peelamedu', 'Singanallur',
];

export const CASHIER_OPTIONS = ['Karthik Kumar', 'Priya Shree', 'Sathish Kumar', 'Kavitha S'];

export const DEFAULT_DATE_RANGE = { from: '2026-05-26', to: '2026-05-26' };

export const SALES_REPORT_ITEMS = [
  { key: 'daily-sales', label: 'Daily Sales', description: 'View daily sales summary and details for selected date.', icon: CalendarTodayOutlinedIcon, color: '#2563EB' },
  { key: 'monthly-sales', label: 'Monthly Sales', description: 'View monthly sales summary and details for selected month.', icon: EventAvailableOutlinedIcon, color: '#22A06B' },
  { key: 'outlet-wise-sales', label: 'Outlet-wise Sales', description: 'Compare sales performance across all outlets.', icon: StorefrontIcon, color: '#F26B21' },
  { key: 'cashier-wise-sales', label: 'Cashier-wise Sales', description: 'View sales performance of individual cashiers.', icon: PersonOutlineOutlinedIcon, color: '#7C3AED' },
  { key: 'item-wise-sales', label: 'Item-wise Sales', description: 'View sales details of individual items.', icon: Inventory2OutlinedIcon, color: '#2563EB' },
  { key: 'category-wise-sales', label: 'Category-wise Sales', description: 'View sales summary by item categories.', icon: LabelOutlinedIcon, color: '#0EA5A4' },
  { key: 'brand-wise-sales', label: 'Brand-wise Sales', description: 'View sales summary by brands.', icon: SellOutlinedIcon, color: '#E5484D' },
  { key: 'customer-wise-sales', label: 'Customer-wise Sales', description: 'View sales summary by customers.', icon: PeopleAltOutlinedIcon, color: '#22A06B' },
  { key: 'hourly-sales', label: 'Hourly Sales', description: 'View hourly sales trend and performance.', icon: AccessTimeOutlinedIcon, color: '#F26B21' },
  { key: 'payment-wise-sales', label: 'Payment-wise Sales', description: 'View sales summary by payment modes.', icon: CreditCardOutlinedIcon, color: '#7C3AED' },
  { key: 'discount-report', label: 'Discount Report', description: 'View discounts given during sales.', icon: PercentOutlinedIcon, color: '#F5A623' },
  { key: 'tax-report', label: 'Tax Report', description: 'View tax collected details and summary.', icon: ReceiptOutlinedIcon, color: '#2563EB' },
  { key: 'return-report', label: 'Return Report', description: 'View sales returns summary and details.', icon: KeyboardReturnOutlinedIcon, color: '#E5484D' },
];
