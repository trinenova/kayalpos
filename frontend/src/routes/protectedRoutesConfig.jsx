import HomePage from '../modules/dashboard/HomePage';
import ManagementDashboardPage from '../modules/dashboard/ManagementDashboardPage';
import LineSalePage from '../modules/line-sale/LineSalePage';
import SalesReturnPage from '../modules/sales-return/SalesReturnPage';
import SalesPage from '../modules/sales/SalesPage';
import InventoryPage from '../modules/inventory/InventoryPage';
import SynchronizationPage from '../modules/synchronization/SynchronizationPage';
import MarketingPage from '../modules/marketing/MarketingPage';
import PromotionPage from '../modules/promotion/PromotionPage';
import GiftVoucherPage from '../modules/gift-voucher/GiftVoucherPage';
import LoyaltyPage from '../modules/loyalty/LoyaltyPage';
import CustomerPage from '../modules/customer/CustomerPage';
import SalesQuotationPage from '../modules/sales-quotation/SalesQuotationPage';
import SalesOrderPage from '../modules/sales-order/SalesOrderPage';
import SalesInvoicePage from '../modules/sales-invoice/SalesInvoicePage';
import DayClosePage from '../modules/day-close/DayClosePage';
import BarcodeLabelPage from '../modules/barcode-label/BarcodeLabelPage';
import StockIndentPage from '../modules/stock-indent/StockIndentPage';
import StockTransferPage from '../modules/stock-transfer/StockTransferPage';
import StockReceiptPage from '../modules/stock-receipt/StockReceiptPage';
import StockReturnPage from '../modules/stock-return/StockReturnPage';
import StockWastagePage from '../modules/stock-wastage/StockWastagePage';
import StockCountPage from '../modules/stock-count/StockCountPage';
import CashierPanelPage from '../modules/cashier-panel/CashierPanelPage';
import CashierLoginPage from '../modules/cashier-panel/CashierLoginPage';
import ShiftOpeningPage from '../modules/cashier-panel/ShiftOpeningPage';
import CashSalesPage from '../modules/cashier-panel/CashSalesPage';
import CardSalesPage from '../modules/cashier-panel/CardSalesPage';
import UpiSalesPage from '../modules/cashier-panel/UpiSalesPage';
import OtherPaymentsPage from '../modules/cashier-panel/OtherPaymentsPage';
import CashWithdrawalPage from '../modules/cashier-panel/CashWithdrawalPage';
import CashDepositPage from '../modules/cashier-panel/CashDepositPage';
import CashTransferPage from '../modules/cashier-panel/CashTransferPage';
import CashDrawerOpeningPage from '../modules/cashier-panel/CashDrawerOpeningPage';
import ShiftClosingPage from '../modules/cashier-panel/ShiftClosingPage';
import CashReconciliationPage from '../modules/cashier-panel/CashReconciliationPage';
import ShortageExcessPage from '../modules/cashier-panel/ShortageExcessPage';
import CashierWiseSalesPage from '../modules/cashier-panel/CashierWiseSalesPage';
import ExpensesBookPage from '../modules/expenses-book/ExpensesBookPage';
import ReportsPage from '../modules/reports/ReportsPage';
import SalesReportsPage from '../modules/reports/sales/SalesReportsPage';
import SalesReportRoute from '../modules/reports/sales/SalesReportRoute';
import InventoryReportsPage from '../modules/reports/inventory/InventoryReportsPage';
import InventoryReportDetailPage from '../modules/reports/inventory/InventoryReportDetailPage';
import PurchaseReportsPage from '../modules/reports/purchase/PurchaseReportsPage';
import CashierReportsPage from '../modules/reports/cashier/CashierReportsPage';
import ShiftVarianceReportPage from '../modules/reports/cashier/ShiftVarianceReportPage';
import CashierReportDetailPage from '../modules/reports/cashier/CashierReportDetailPage';
import FinancialReportsPage from '../modules/reports/financial/FinancialReportsPage';
import GrossProfitReportPage from '../modules/reports/financial/GrossProfitReportPage';
import NetSalesReportPage from '../modules/reports/financial/NetSalesReportPage';
import ExpenseReportPage from '../modules/reports/financial/ExpenseReportPage';
import ProfitabilityReportPage from '../modules/reports/financial/ProfitabilityReportPage';
import TaxSummaryReportPage from '../modules/reports/financial/TaxSummaryReportPage';
import OutstandingReportPage from '../modules/reports/financial/OutstandingReportPage';
import PaymentCollectionReportPage from '../modules/reports/financial/PaymentCollectionReportPage';
import SapReportsPage from '../modules/reports/sap/SapReportsPage';
import MasterSyncPage from '../modules/master-sync/MasterSyncPage';
import StockSyncPage from '../modules/stock-sync/StockSyncPage';
import MastersPage from '../modules/masters/MastersPage';
import CompanyPage from '../modules/masters/company/CompanyPage';
import OutletPage from '../modules/masters/outlet/OutletPage';
import WarehousePage from '../modules/masters/warehouse/WarehousePage';
import WarehouseListPage from '../modules/masters/warehouse/WarehouseListPage';
import ProductPage from '../modules/masters/product/ProductPage';
import BrandPage from '../modules/masters/brand/BrandPage';
import ItemGroupPage from '../modules/masters/item-group/ItemGroupPage';
import UomPage from '../modules/masters/uom/UomPage';
import TaxCodePage from '../modules/masters/tax-code/TaxCodePage';
import HsnSacPage from '../modules/masters/hsn-sac/HsnSacPage';
import SellingPricePage from '../modules/masters/selling-price/SellingPricePage';
import PriceListPage from '../modules/masters/price-list/PriceListPage';
import BatchSerialPage from '../modules/masters/batch-serial/BatchSerialPage';
import SupplierPage from '../modules/masters/supplier/SupplierPage';
import EmployeePage from '../modules/masters/employee/EmployeePage';
import UserManagementPage from '../modules/user-management/UserManagementPage';
import SettingsPage from '../modules/settings/SettingsPage';
import ProfilePage from '../modules/settings/ProfilePage';

/**
 * Every page reachable once logged in, as plain {path, element} data
 * instead of literal `<Route>` JSX — so the exact same list can be
 * rendered twice: once by App.jsx's top-level `<Routes>` (ordinary
 * route matching/gating — unchanged), and once per open tab inside
 * KeepAliveTabContent.jsx, each via its own `<Routes location={{pathname}}>`
 * pinned to that tab's path. That second use is what makes a tab's page
 * component mount exactly once and stay mounted (just hidden) while you
 * switch to other tabs — see KeepAliveTabContent.jsx's doc comment for why
 * that's what actually stops a tab's in-progress work (a return's cart, a
 * sale in progress, ...) from resetting every time you switch away and
 * back, which plain react-router Outlet-based switching can't do (it
 * unmounts the previous route's component on every navigation).
 *
 * A route with a dynamic segment (:id, :reportKey, ...) works the same way
 * here as it already did under the old inline App.jsx list — the tab
 * strip keys tabs by the exact resolved pathname (e.g.
 * "/masters/warehouse/abc123"), not by this pattern, so two tabs open on
 * two different warehouse ids are naturally two separate kept-alive
 * instances, each still matched against this same ":id" pattern.
 */
export const protectedRoutesConfig = [
  { path: '/home', element: <HomePage /> },
  { path: '/dashboard', element: <ManagementDashboardPage /> },
  { path: '/line-sale', element: <LineSalePage /> },
  { path: '/sales-return', element: <SalesReturnPage /> },
  { path: '/sales', element: <SalesPage /> },
  { path: '/inventory', element: <InventoryPage /> },
  { path: '/synchronization', element: <SynchronizationPage /> },
  { path: '/marketing', element: <MarketingPage /> },
  { path: '/promotion', element: <PromotionPage /> },
  { path: '/gift-voucher', element: <GiftVoucherPage /> },
  { path: '/loyalty', element: <LoyaltyPage /> },
  { path: '/customer', element: <CustomerPage /> },
  { path: '/sales-quotation', element: <SalesQuotationPage /> },
  { path: '/sales-order', element: <SalesOrderPage /> },
  { path: '/sales-invoice', element: <SalesInvoicePage /> },
  { path: '/day-close', element: <DayClosePage /> },
  { path: '/barcode-label', element: <BarcodeLabelPage /> },
  { path: '/stock-indent', element: <StockIndentPage /> },
  { path: '/stock-transfer', element: <StockTransferPage /> },
  { path: '/stock-receipt', element: <StockReceiptPage /> },
  { path: '/stock-return', element: <StockReturnPage /> },
  { path: '/stock-wastage', element: <StockWastagePage /> },
  { path: '/stock-count', element: <StockCountPage /> },
  { path: '/expenses-book', element: <ExpensesBookPage /> },
  { path: '/reports', element: <ReportsPage /> },
  { path: '/reports/sales', element: <SalesReportsPage /> },
  { path: '/reports/sales/:reportKey', element: <SalesReportRoute /> },
  { path: '/reports/inventory', element: <InventoryReportsPage /> },
  { path: '/reports/inventory/:reportKey', element: <InventoryReportDetailPage /> },
  { path: '/reports/purchase', element: <PurchaseReportsPage /> },
  { path: '/reports/cashier', element: <CashierReportsPage /> },
  { path: '/reports/cashier/shift-variance', element: <ShiftVarianceReportPage /> },
  { path: '/reports/cashier/:reportKey', element: <CashierReportDetailPage /> },
  { path: '/reports/financial', element: <FinancialReportsPage /> },
  { path: '/reports/financial/gross-profit', element: <GrossProfitReportPage /> },
  { path: '/reports/financial/net-sales', element: <NetSalesReportPage /> },
  { path: '/reports/financial/expenses', element: <ExpenseReportPage /> },
  { path: '/reports/financial/profitability', element: <ProfitabilityReportPage /> },
  { path: '/reports/financial/tax-summary', element: <TaxSummaryReportPage /> },
  { path: '/reports/financial/outstanding', element: <OutstandingReportPage /> },
  { path: '/reports/financial/payment-collection', element: <PaymentCollectionReportPage /> },
  { path: '/reports/sap', element: <SapReportsPage /> },
  { path: '/master-sync', element: <MasterSyncPage /> },
  { path: '/stock-sync', element: <StockSyncPage /> },
  { path: '/masters', element: <MastersPage /> },
  { path: '/masters/company', element: <CompanyPage /> },
  { path: '/masters/outlet', element: <OutletPage /> },
  { path: '/masters/warehouse', element: <WarehouseListPage /> },
  { path: '/masters/warehouse/new', element: <WarehousePage /> },
  { path: '/masters/warehouse/:id', element: <WarehousePage /> },
  { path: '/masters/product', element: <ProductPage /> },
  { path: '/masters/brand', element: <BrandPage /> },
  { path: '/masters/item-group', element: <ItemGroupPage /> },
  { path: '/masters/uom', element: <UomPage /> },
  { path: '/masters/tax-code', element: <TaxCodePage /> },
  { path: '/masters/hsn-sac', element: <HsnSacPage /> },
  { path: '/masters/selling-price', element: <SellingPricePage /> },
  { path: '/masters/price-list', element: <PriceListPage /> },
  { path: '/masters/batch-serial', element: <BatchSerialPage /> },
  { path: '/masters/supplier', element: <SupplierPage /> },
  { path: '/masters/employee', element: <EmployeePage /> },
  { path: '/cashier-panel', element: <CashierPanelPage /> },
  { path: '/cashier-panel/login', element: <CashierLoginPage /> },
  { path: '/cashier-panel/shift-opening', element: <ShiftOpeningPage /> },
  { path: '/cashier-panel/cash-sales', element: <CashSalesPage /> },
  { path: '/cashier-panel/card-sales', element: <CardSalesPage /> },
  { path: '/cashier-panel/upi-sales', element: <UpiSalesPage /> },
  { path: '/cashier-panel/other-payments', element: <OtherPaymentsPage /> },
  { path: '/cashier-panel/cash-withdrawal', element: <CashWithdrawalPage /> },
  { path: '/cashier-panel/cash-deposit', element: <CashDepositPage /> },
  { path: '/cashier-panel/cash-transfer', element: <CashTransferPage /> },
  { path: '/cashier-panel/cash-drawer-opening', element: <CashDrawerOpeningPage /> },
  { path: '/cashier-panel/shift-closing', element: <ShiftClosingPage /> },
  { path: '/cashier-panel/cash-reconciliation', element: <CashReconciliationPage /> },
  { path: '/cashier-panel/shortage-excess', element: <ShortageExcessPage /> },
  { path: '/cashier-panel/cashier-wise-sales', element: <CashierWiseSalesPage /> },
  { path: '/user-management', element: <UserManagementPage /> },
  { path: '/settings', element: <SettingsPage /> },
  { path: '/settings/profile', element: <ProfilePage /> },
];
