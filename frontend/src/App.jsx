import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './modules/auth/LoginPage';
import HomePage from './modules/dashboard/HomePage';
import ManagementDashboardPage from './modules/dashboard/ManagementDashboardPage';
import LineSalePage from './modules/line-sale/LineSalePage';
import SalesReturnPage from './modules/sales-return/SalesReturnPage';
import SalesPage from './modules/sales/SalesPage';
import InventoryPage from './modules/inventory/InventoryPage';
import SynchronizationPage from './modules/synchronization/SynchronizationPage';
import MarketingPage from './modules/marketing/MarketingPage';
import PromotionPage from './modules/promotion/PromotionPage';
import GiftVoucherPage from './modules/gift-voucher/GiftVoucherPage';
import LoyaltyPage from './modules/loyalty/LoyaltyPage';
import CustomerPage from './modules/customer/CustomerPage';
import SalesQuotationPage from './modules/sales-quotation/SalesQuotationPage';
import SalesOrderPage from './modules/sales-order/SalesOrderPage';
import SalesInvoicePage from './modules/sales-invoice/SalesInvoicePage';
import DayClosePage from './modules/day-close/DayClosePage';
import BarcodeLabelPage from './modules/barcode-label/BarcodeLabelPage';
import StockIndentPage from './modules/stock-indent/StockIndentPage';
import StockTransferPage from './modules/stock-transfer/StockTransferPage';
import StockReceiptPage from './modules/stock-receipt/StockReceiptPage';
import StockReturnPage from './modules/stock-return/StockReturnPage';
import StockWastagePage from './modules/stock-wastage/StockWastagePage';
import StockCountPage from './modules/stock-count/StockCountPage';
import CashierPanelPage from './modules/cashier-panel/CashierPanelPage';
import CashierLoginPage from './modules/cashier-panel/CashierLoginPage';
import ShiftOpeningPage from './modules/cashier-panel/ShiftOpeningPage';
import CashSalesPage from './modules/cashier-panel/CashSalesPage';
import CardSalesPage from './modules/cashier-panel/CardSalesPage';
import UpiSalesPage from './modules/cashier-panel/UpiSalesPage';
import OtherPaymentsPage from './modules/cashier-panel/OtherPaymentsPage';
import CashWithdrawalPage from './modules/cashier-panel/CashWithdrawalPage';
import CashDepositPage from './modules/cashier-panel/CashDepositPage';
import CashTransferPage from './modules/cashier-panel/CashTransferPage';
import CashDrawerOpeningPage from './modules/cashier-panel/CashDrawerOpeningPage';
import ShiftClosingPage from './modules/cashier-panel/ShiftClosingPage';
import CashReconciliationPage from './modules/cashier-panel/CashReconciliationPage';
import ShortageExcessPage from './modules/cashier-panel/ShortageExcessPage';
import CashierWiseSalesPage from './modules/cashier-panel/CashierWiseSalesPage';
import ExpensesBookPage from './modules/expenses-book/ExpensesBookPage';
import ReportsPage from './modules/reports/ReportsPage';
import SalesReportsPage from './modules/reports/sales/SalesReportsPage';
import SalesReportDetailPage from './modules/reports/sales/SalesReportDetailPage';
import InventoryReportsPage from './modules/reports/inventory/InventoryReportsPage';
import InventoryReportDetailPage from './modules/reports/inventory/InventoryReportDetailPage';
import PurchaseReportsPage from './modules/reports/purchase/PurchaseReportsPage';
import CashierReportsPage from './modules/reports/cashier/CashierReportsPage';
import ShiftVarianceReportPage from './modules/reports/cashier/ShiftVarianceReportPage';
import CashierReportDetailPage from './modules/reports/cashier/CashierReportDetailPage';
import FinancialReportsPage from './modules/reports/financial/FinancialReportsPage';
import SapReportsPage from './modules/reports/sap/SapReportsPage';
import MasterSyncPage from './modules/master-sync/MasterSyncPage';
import StockSyncPage from './modules/stock-sync/StockSyncPage';
import MastersPage from './modules/masters/MastersPage';
import CompanyPage from './modules/masters/company/CompanyPage';
import OutletPage from './modules/masters/outlet/OutletPage';
import WarehousePage from './modules/masters/warehouse/WarehousePage';
import WarehouseListPage from './modules/masters/warehouse/WarehouseListPage';
import ProductPage from './modules/masters/product/ProductPage';
import BrandPage from './modules/masters/brand/BrandPage';
import UomPage from './modules/masters/uom/UomPage';
import TaxCodePage from './modules/masters/tax-code/TaxCodePage';
import HsnSacPage from './modules/masters/hsn-sac/HsnSacPage';
import SellingPricePage from './modules/masters/selling-price/SellingPricePage';
import PriceListPage from './modules/masters/price-list/PriceListPage';
import BatchSerialPage from './modules/masters/batch-serial/BatchSerialPage';
import SupplierPage from './modules/masters/supplier/SupplierPage';
import EmployeePage from './modules/masters/employee/EmployeePage';
import SettingsPage from './modules/settings/SettingsPage';
import ProfilePage from './modules/settings/ProfilePage';
import ProtectedRoute from './routes/ProtectedRoute';
import GuestRoute from './routes/GuestRoute';
import AppShell from './components/layout/AppShell';
import GlobalToast from './components/common/GlobalToast';
import { useAuthSync } from './hooks/useAuthSync';
import { useInactivityTimeout } from './hooks/useInactivityTimeout';

export default function App() {
  useAuthSync();
  useInactivityTimeout();
  return (
    <>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/dashboard" element={<ManagementDashboardPage />} />
            <Route path="/line-sale" element={<LineSalePage />} />
            <Route path="/sales-return" element={<SalesReturnPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/synchronization" element={<SynchronizationPage />} />
            <Route path="/marketing" element={<MarketingPage />} />
            <Route path="/promotion" element={<PromotionPage />} />
            <Route path="/gift-voucher" element={<GiftVoucherPage />} />
            <Route path="/loyalty" element={<LoyaltyPage />} />
            <Route path="/customer" element={<CustomerPage />} />
            <Route path="/sales-quotation" element={<SalesQuotationPage />} />
            <Route path="/sales-order" element={<SalesOrderPage />} />
            <Route path="/sales-invoice" element={<SalesInvoicePage />} />
            <Route path="/day-close" element={<DayClosePage />} />
            <Route path="/barcode-label" element={<BarcodeLabelPage />} />
            <Route path="/stock-indent" element={<StockIndentPage />} />
            <Route path="/stock-transfer" element={<StockTransferPage />} />
            <Route path="/stock-receipt" element={<StockReceiptPage />} />
            <Route path="/stock-return" element={<StockReturnPage />} />
            <Route path="/stock-wastage" element={<StockWastagePage />} />
            <Route path="/stock-count" element={<StockCountPage />} />
            <Route path="/expenses-book" element={<ExpensesBookPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/sales" element={<SalesReportsPage />} />
            <Route path="/reports/sales/:reportKey" element={<SalesReportDetailPage />} />
            <Route path="/reports/inventory" element={<InventoryReportsPage />} />
            <Route path="/reports/inventory/:reportKey" element={<InventoryReportDetailPage />} />
            <Route path="/reports/purchase" element={<PurchaseReportsPage />} />
            <Route path="/reports/cashier" element={<CashierReportsPage />} />
            <Route path="/reports/cashier/shift-variance" element={<ShiftVarianceReportPage />} />
            <Route path="/reports/cashier/:reportKey" element={<CashierReportDetailPage />} />
            <Route path="/reports/financial" element={<FinancialReportsPage />} />
            <Route path="/reports/sap" element={<SapReportsPage />} />
            <Route path="/master-sync" element={<MasterSyncPage />} />
            <Route path="/stock-sync" element={<StockSyncPage />} />
            <Route path="/masters" element={<MastersPage />} />
            <Route path="/masters/company" element={<CompanyPage />} />
            <Route path="/masters/outlet" element={<OutletPage />} />
            <Route path="/masters/warehouse" element={<WarehouseListPage />} />
            <Route path="/masters/warehouse/new" element={<WarehousePage />} />
            <Route path="/masters/warehouse/:id" element={<WarehousePage />} />
            <Route path="/masters/product" element={<ProductPage />} />
            <Route path="/masters/brand" element={<BrandPage />} />
            <Route path="/masters/uom" element={<UomPage />} />
            <Route path="/masters/tax-code" element={<TaxCodePage />} />
            <Route path="/masters/hsn-sac" element={<HsnSacPage />} />
            <Route path="/masters/selling-price" element={<SellingPricePage />} />
            <Route path="/masters/price-list" element={<PriceListPage />} />
            <Route path="/masters/batch-serial" element={<BatchSerialPage />} />
            <Route path="/masters/supplier" element={<SupplierPage />} />
            <Route path="/masters/employee" element={<EmployeePage />} />
            <Route path="/cashier-panel" element={<CashierPanelPage />} />
            <Route path="/cashier-panel/login" element={<CashierLoginPage />} />
            <Route path="/cashier-panel/shift-opening" element={<ShiftOpeningPage />} />
            <Route path="/cashier-panel/cash-sales" element={<CashSalesPage />} />
            <Route path="/cashier-panel/card-sales" element={<CardSalesPage />} />
            <Route path="/cashier-panel/upi-sales" element={<UpiSalesPage />} />
            <Route path="/cashier-panel/other-payments" element={<OtherPaymentsPage />} />
            <Route path="/cashier-panel/cash-withdrawal" element={<CashWithdrawalPage />} />
            <Route path="/cashier-panel/cash-deposit" element={<CashDepositPage />} />
            <Route path="/cashier-panel/cash-transfer" element={<CashTransferPage />} />
            <Route path="/cashier-panel/cash-drawer-opening" element={<CashDrawerOpeningPage />} />
            <Route path="/cashier-panel/shift-closing" element={<ShiftClosingPage />} />
            <Route path="/cashier-panel/cash-reconciliation" element={<CashReconciliationPage />} />
            <Route path="/cashier-panel/shortage-excess" element={<ShortageExcessPage />} />
            <Route path="/cashier-panel/cashier-wise-sales" element={<CashierWiseSalesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/profile" element={<ProfilePage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      <GlobalToast />
    </>
  );
}
