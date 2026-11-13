import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import PieChartOutlineOutlinedIcon from '@mui/icons-material/PieChartOutlineOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';

/**
 * TEMPORARY mock data for the Financial Reports screen. There's no Reports
 * backend module yet, so this static snapshot stands in for a
 * `useGetFinancialReportsMenuQuery()`. Replace with real API data once that
 * module exists — do not add more mock data here in the meantime.
 */

export const CASHIER = { name: 'Karthik', code: 'C001' };

export const OUTLET_OPTIONS = [
  'Main Outlet', 'Head Office', 'Saravanampatti', 'Peelamedu', 'Singanallur',
];

export const FINANCIAL_YEAR_OPTIONS = ['2024-2025', '2025-2026', '2026-2027', '2027-2028'];

export const DEFAULT_DATE_RANGE = { from: '2026-05-26', to: '2026-05-26' };

export const DEFAULT_FINANCIAL_YEAR = '2026-2027';

export const FINANCIAL_REPORT_ITEMS = [
  { key: 'gross-profit', label: 'Gross Profit', description: 'View gross profit summary and trends.', icon: TrendingUpOutlinedIcon, color: '#2563EB', path: '/reports/financial/gross-profit' },
  { key: 'net-sales', label: 'Net Sales', description: 'View net sales summary and performance.', icon: ShoppingCartOutlinedIcon, color: '#22A06B', path: '/reports/financial/net-sales' },
  { key: 'expenses', label: 'Expenses', description: 'View all expenses summary and details.', icon: ReceiptLongOutlinedIcon, color: '#F26B21', path: '/reports/financial/expenses' },
  { key: 'profitability', label: 'Profitability', description: 'View profitability analysis and reports.', icon: PieChartOutlineOutlinedIcon, color: '#7C3AED', path: '/reports/financial/profitability' },
  { key: 'tax-summary', label: 'Tax Summary', description: 'View tax collected summary and details.', icon: ReceiptOutlinedIcon, color: '#0EA5A4', path: '/reports/financial/tax-summary' },
  { key: 'outstanding', label: 'Outstanding', description: 'View customer and supplier outstanding reports.', icon: PersonOutlineOutlinedIcon, color: '#E23E8C', path: '/reports/financial/outstanding' },
  { key: 'payment-collection', label: 'Payment Collection', description: 'View payment collection summary and details.', icon: PaymentsOutlinedIcon, color: '#F5A623', path: '/reports/financial/payment-collection' },
];
