import { useState } from 'react';
import { Grid, Stack, Box, CircularProgress, Alert } from '@mui/material';
import CurrencyRupeeOutlinedIcon from '@mui/icons-material/CurrencyRupeeOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';

import { useAppSelector } from '../../app/hooks';
import { selectActiveOutletId } from '../../features/auth/authSlice';
import { useGetHomeDashboardQuery } from '../../api/dashboardApi';
import StatCard from '../../components/common/StatCard';
import InfoCard from '../../components/common/InfoCard';
import QuickAccessGrid from '../../components/common/QuickAccessGrid';
import TrendChart from '../../components/common/TrendChart';
import DonutChart from '../../components/common/DonutChart';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import PeriodSelect from '../../components/common/PeriodSelect';
import { useQuickAccessItems } from '../../components/layout/navConfig';
import { formatCurrency, formatNumber } from '../../utils/format';
import TopSellingList from './components/TopSellingList';

const PAYMENT_COLORS = { Cash: '#22A06B', UPI: '#2563EB', Card: '#8B5CF6', Wallet: '#F5A623', Credit: '#E5484D' };

export default function HomePage() {
  const outletId = useAppSelector(selectActiveOutletId);
  const [salesPeriod, setSalesPeriod] = useState('month');
  const [topSellingPeriod, setTopSellingPeriod] = useState('month');
  // Both period dropdowns are real query params now (see dashboardApi.js /
  // dashboard.schema.js) — changing either refetches just that panel's data
  // via RTK Query's cache-key-changed refetch, not the whole page reloading.
  const { data, isLoading, isError } = useGetHomeDashboardQuery({ outletId, salesPeriod, topSellingPeriod });
  const quickAccessItems = useQuickAccessItems();

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

  const { stats, salesOverview, topSellingItems, paymentSummary, recentTransactions, lowStockDetails } = data;

  const transactionColumns = [
    { key: 'invoiceNo', label: 'Invoice No' },
    { key: 'type', label: 'Type' },
    { key: 'customer', label: 'Customer' },
    { key: 'amount', label: 'Amount', align: 'right', render: (row) => formatCurrency(row.amount, { decimals: true }) },
    { key: 'time', label: 'Time' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];

  const lowStockColumns = [
    { key: 'name', label: 'Item Name' },
    {
      key: 'stock',
      label: 'Stock / Reorder',
      render: (row) => `${row.currentStock} / ${row.reorderLevel} ${row.reorderUnit}`,
    },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard
            variant="gradient"
            icon={CurrencyRupeeOutlinedIcon}
            iconColor="primary"
            label="Total Sales (Today)"
            value={formatCurrency(stats.totalSalesToday.value, { decimals: true })}
            delta={{ value: `${stats.totalSalesToday.deltaPct}%`, direction: stats.totalSalesToday.direction, label: 'vs Yesterday' }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard
            variant="gradient"
            icon={ShoppingCartOutlinedIcon}
            iconColor="success"
            label="Orders (Today)"
            value={formatNumber(stats.ordersToday.value)}
            delta={{ value: `${stats.ordersToday.deltaPct}%`, direction: stats.ordersToday.direction, label: 'vs Yesterday' }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard
            variant="gradient"
            icon={Inventory2OutlinedIcon}
            iconColor="info"
            label="Total Items"
            value={formatNumber(stats.totalItems.value)}
            caption="Total Active Items"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard
            variant="gradient"
            icon={WarningAmberOutlinedIcon}
            iconColor="error"
            label="Low Stock Items"
            value={formatNumber(stats.lowStockItems.value)}
            link={{ label: 'View Details', to: '/stock-count' }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard
            variant="gradient"
            icon={PeopleAltOutlinedIcon}
            iconColor="secondary"
            label="Total Customers"
            value={formatNumber(stats.totalCustomers.value)}
            delta={{ value: `${stats.totalCustomers.deltaPct}%`, direction: stats.totalCustomers.direction, label: 'vs Last Month' }}
          />
        </Grid>
      </Grid>

      {/* Two equal-height columns (Grid items stretch by default; each column is a
          flex column whose cards grow to fill the leftover height). */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Stack spacing={2} sx={{ height: '100%' }}>
            <InfoCard variant="panel" icon={BoltOutlinedIcon} title="Quick Access" sx={{ height: 'auto', flex: '0 0 auto' }}>
              <QuickAccessGrid items={quickAccessItems} />
            </InfoCard>

            <InfoCard variant="panel" icon={ReceiptLongOutlinedIcon} tone="primary" title="Recent Transactions" sx={{ height: 'auto', flex: '1 1 auto' }}>
              <DataTable columns={transactionColumns} rows={recentTransactions} getRowKey={(r) => r.id} />
            </InfoCard>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Stack spacing={2} sx={{ height: '100%' }}>
            <InfoCard variant="panel" icon={ShowChartOutlinedIcon}
              title="Sales Overview"
              action={<PeriodSelect value={salesPeriod} onChange={setSalesPeriod} options={[{ value: 'month', label: 'This Month' }, { value: 'week', label: 'This Week' }]} />}
              sx={{ height: 'auto', flex: '1 1 auto' }}
            >
              <TrendChart categories={salesOverview.categories} values={salesOverview.values} height={220} area />
            </InfoCard>

            <Grid container spacing={2} sx={{ flex: '1 1 auto' }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <InfoCard variant="panel" icon={EmojiEventsOutlinedIcon} tone="primary"
                  title="Top Selling Items"
                  action={<PeriodSelect value={topSellingPeriod} onChange={setTopSellingPeriod} options={[{ value: 'month', label: 'This Month' }, { value: 'week', label: 'This Week' }]} />}
                  link={{ label: 'View All', to: '/reports' }}
                >
                  <TopSellingList items={topSellingItems} />
                </InfoCard>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <InfoCard variant="panel" icon={PaymentsOutlinedIcon} title="Payment Summary (Today)">
                  <DonutChart
                    data={paymentSummary.breakdown.map((b) => ({ id: b.method, label: b.method, value: b.amount, color: PAYMENT_COLORS[b.method] }))}
                    centerValue={formatCurrency(paymentSummary.total)}
                    centerLabel="Total"
                    formatValue={(v) => formatCurrency(v)}
                  />
                </InfoCard>
              </Grid>
            </Grid>

            <InfoCard variant="panel" icon={WarningAmberOutlinedIcon} title="Low Stock Items" link={{ label: 'View All', to: '/stock-count' }} sx={{ height: 'auto', flex: '1 1 auto' }}>
              <DataTable columns={lowStockColumns} rows={lowStockDetails} getRowKey={(r) => r.id} dense />
            </InfoCard>
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}
