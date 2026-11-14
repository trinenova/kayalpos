import { useState } from 'react';
import { Grid, Stack, Box, CircularProgress, Alert } from '@mui/material';
import CurrencyRupeeOutlinedIcon from '@mui/icons-material/CurrencyRupeeOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';

import { useGetManagementDashboardQuery } from '../../api/dashboardApi';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import InfoCard from '../../components/common/InfoCard';
import TrendChart from '../../components/common/TrendChart';
import DonutChart from '../../components/common/DonutChart';
import PeriodSelect from '../../components/common/PeriodSelect';
import { formatCurrency } from '../../utils/format';
import DashboardDateControl from './components/DashboardDateControl';
import AlertStatsRow from './components/AlertStatsRow';
import TopSellingTable from './components/TopSellingTable';
import OutletPerformanceTable from './components/OutletPerformanceTable';
import ExpenseSummaryPanel from './components/ExpenseSummaryPanel';
import InventorySummaryPanel from './components/InventorySummaryPanel';
import ReceivablesPayablesPanel from './components/ReceivablesPayablesPanel';
import ProfitOverviewPanel from './components/ProfitOverviewPanel';

const OUTLET_COLORS = ['#6B7280', '#F5A623', '#22A06B', '#E5484D', '#8B5CF6'];
const PAYMENT_COLORS = { Cash: '#22A06B', UPI: '#2563EB', Card: '#8B5CF6', Wallet: '#F5A623', Credit: '#E5484D' };

export default function ManagementDashboardPage() {
  const { data, isLoading, isError } = useGetManagementDashboardQuery();
  const [trendPeriod, setTrendPeriod] = useState('month');

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !data) {
    return <Alert severity="error">Couldn't load the dashboard. Please try again shortly.</Alert>;
  }

  const {
    stats,
    salesTrend,
    salesByOutlet,
    paymentMethodSummary,
    alerts,
    topSellingItems,
    outletPerformance,
    expenseSummary,
    inventorySummary,
    receivablesPayables,
    profitOverview,
  } = data;

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Management Dashboard"
        subtitle="Complete overview of your business performance"
        icon={DashboardOutlinedIcon}
        action={<DashboardDateControl />}
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <StatCard variant="gradient" icon={CurrencyRupeeOutlinedIcon} iconColor="primary" label="Total Sales (Today)" value={formatCurrency(stats.totalSalesToday.value, { decimals: true })} delta={{ value: `${stats.totalSalesToday.deltaPct}%`, direction: stats.totalSalesToday.direction, label: 'vs Yesterday' }} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <StatCard variant="gradient" icon={ShoppingCartOutlinedIcon} iconColor="info" label="Total Purchase (Today)" value={formatCurrency(stats.totalPurchaseToday.value, { decimals: true })} delta={{ value: `${stats.totalPurchaseToday.deltaPct}%`, direction: stats.totalPurchaseToday.direction, label: 'vs Yesterday' }} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <StatCard variant="gradient" icon={TrendingUpOutlinedIcon} iconColor="success" label="Gross Profit (Today)" value={formatCurrency(stats.grossProfitToday.value, { decimals: true })} delta={{ value: `${stats.grossProfitToday.deltaPct}%`, direction: stats.grossProfitToday.direction, label: 'vs Yesterday' }} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <StatCard variant="gradient" icon={SavingsOutlinedIcon} iconColor="secondary" label="Net Profit (Today)" value={formatCurrency(stats.netProfitToday.value, { decimals: true })} delta={{ value: `${stats.netProfitToday.deltaPct}%`, direction: stats.netProfitToday.direction, label: 'vs Yesterday' }} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <StatCard variant="gradient" icon={PaymentsOutlinedIcon} iconColor="error" label="Total Expenses (Today)" value={formatCurrency(stats.totalExpensesToday.value, { decimals: true })} delta={{ value: `${stats.totalExpensesToday.deltaPct}%`, direction: stats.totalExpensesToday.direction, label: 'vs Yesterday' }} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <StatCard variant="gradient" icon={WarehouseOutlinedIcon} iconColor="info" label="Stock Value" value={formatCurrency(stats.stockValue.value)} caption="Total Inventory Value" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6, lg: 4.5 }}>
          <InfoCard variant="panel" icon={ShowChartOutlinedIcon}
            title="Sales Trend"
            action={<PeriodSelect value={trendPeriod} onChange={setTrendPeriod} options={[{ value: 'month', label: 'This Month' }, { value: 'week', label: 'This Week' }]} />}
          >
            <TrendChart categories={salesTrend.categories} values={salesTrend.values} height={230} area />
          </InfoCard>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3.75 }}>
          <InfoCard variant="panel" icon={StorefrontOutlinedIcon} title="Sales by Outlet">
            <DonutChart
              data={salesByOutlet.breakdown.map((b, i) => ({ id: b.outlet, label: b.outlet, value: b.amount, color: OUTLET_COLORS[i % OUTLET_COLORS.length] }))}
              centerValue={formatCurrency(salesByOutlet.total)}
              centerLabel="Total Sales"
              formatValue={(v) => formatCurrency(v)}
              size={140}
            />
          </InfoCard>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3.75 }}>
          <InfoCard variant="panel" icon={PaymentsOutlinedIcon} title="Payment Method Summary">
            <DonutChart
              data={paymentMethodSummary.breakdown.map((b) => ({ id: b.method, label: b.method, value: b.amount, color: PAYMENT_COLORS[b.method] }))}
              centerValue={formatCurrency(paymentMethodSummary.total)}
              centerLabel="Total"
              formatValue={(v) => formatCurrency(v)}
              size={140}
            />
          </InfoCard>
        </Grid>
      </Grid>

      <AlertStatsRow alerts={alerts} />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <InfoCard variant="panel" icon={EmojiEventsOutlinedIcon} tone="primary" title="Top Selling Items" subtitle="This Month" link={{ label: 'View All', to: '/reports' }}>
            <TopSellingTable items={topSellingItems} />
          </InfoCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <InfoCard variant="panel" icon={StorefrontOutlinedIcon} tone="primary" title="Today's Outlet Performance" link={{ label: 'View All', to: '/reports' }}>
            <OutletPerformanceTable rows={outletPerformance} />
          </InfoCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <InfoCard variant="panel" icon={AccountBalanceWalletOutlinedIcon} title="Expense Summary" subtitle="This Month" link={{ label: 'View Details', to: '/expenses-book' }}>
            <ExpenseSummaryPanel summary={expenseSummary} />
          </InfoCard>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <InfoCard variant="panel" icon={Inventory2OutlinedIcon} title="Inventory Summary">
            <InventorySummaryPanel summary={inventorySummary} />
          </InfoCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <InfoCard variant="panel" icon={SwapHorizOutlinedIcon} title="Receivables & Payables">
            <ReceivablesPayablesPanel data={receivablesPayables} />
          </InfoCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <InfoCard variant="panel" icon={TrendingUpOutlinedIcon} title="Profit Overview" subtitle="This Month" link={{ label: 'View Profitability Report', to: '/reports' }}>
            <ProfitOverviewPanel data={profitOverview} />
          </InfoCard>
        </Grid>
      </Grid>
    </Stack>
  );
}
