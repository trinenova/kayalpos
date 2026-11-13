import { useParams } from 'react-router-dom';

import SalesReportDetailPage from './SalesReportDetailPage';
import SalesSummaryReportPage from './SalesSummaryReportPage';
import { SALES_REPORTS } from './salesReportConfig';

/**
 * /reports/sales/:reportKey — one route, two report families:
 *  - Daily / Monthly / Outlet-wise / Cashier-wise / Item-wise / Category-wise /
 *    Brand-wise / Customer-wise  -> SalesSummaryReportPage (salesReportConfig.js)
 *  - Hourly / Payment-wise / Discount / Tax / Return                    -> SalesReportDetailPage
 *    (salesReportDefinitions.js; unknown keys redirect to the landing page there)
 */
export default function SalesReportRoute() {
  const { reportKey } = useParams();
  if (SALES_REPORTS[reportKey]) return <SalesSummaryReportPage key={reportKey} />;
  return <SalesReportDetailPage />;
}
