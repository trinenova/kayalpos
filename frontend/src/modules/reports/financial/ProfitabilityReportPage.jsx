import { Stack, Grid } from '@mui/material';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';

import { downloadCsv } from '../../../utils/exportCsv';
import { useProfitabilityReportQuery } from '../../../api/financialReportsApi';
import {
  ReportHeader, FilterBar, StatRow, ErrorNote, DataTable, NoteAlert, useReportFilters, money, showDate, profitColor,
} from './reportKit';

/** Profitability: net sales - cost of goods = gross profit; - expenses = net profit. */
export default function ProfitabilityReportPage() {
  const filters = useReportFilters();
  const {
    data, isLoading, isFetching, isError, error, refetch,
  } = useProfitabilityReportQuery(filters.params);
  const s = data?.summary;

  const exportCsv = () => downloadCsv(
    `profitability_${data.from}_${data.to}.csv`,
    ['Date', 'Net sales', 'Cost of goods', 'Gross profit', 'Expenses', 'Net profit'],
    data.daily.map((d) => [d.day, d.netSales, d.cost, d.grossProfit, d.expenses, d.netProfit]),
  );

  return (
    <Stack spacing={2}>
      <ReportHeader title="Profitability" />
      <FilterBar filters={filters} />
      <ErrorNote isError={isError} error={error} refetch={refetch} />
      <StatRow
        isLoading={isLoading}
        cards={[
          { icon: ShoppingCartOutlinedIcon, iconColor: '#22A06B', label: 'Net sales', value: s && money(s.netSales), caption: 'Excl. GST' },
          { icon: TrendingUpOutlinedIcon, iconColor: '#2563EB', label: 'Gross profit', value: s && money(s.grossProfit), caption: s && `${s.grossMarginPct}% margin · cost ${money(s.cost)}` },
          { icon: ReceiptLongOutlinedIcon, iconColor: '#F26B21', label: 'Expenses', value: s && money(s.expenses), caption: 'Incl. tax' },
          { icon: SavingsOutlinedIcon, iconColor: '#7C3AED', label: 'Net profit', value: s && money(s.netProfit), caption: s && `${s.netMarginPct}% of net sales` },
        ]}
      />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <DataTable
            title="Profit by day"
            isLoading={isLoading}
            dim={isFetching && !isLoading}
            rows={data?.daily}
            paged
            minWidth={620}
            onExport={exportCsv}
            rowKey={(r) => r.day}
            empty="No sales or expenses in this period."
            columns={[
              { label: 'Date', render: (r) => showDate(r.day), nowrap: true },
              { label: 'Net sales', align: 'right', num: true, render: (r) => money(r.netSales) },
              { label: 'Cost', align: 'right', num: true, render: (r) => money(r.cost) },
              { label: 'Gross profit', align: 'right', num: true, render: (r) => money(r.grossProfit) },
              { label: 'Expenses', align: 'right', num: true, render: (r) => money(r.expenses) },
              { label: 'Net profit', align: 'right', num: true, bold: true, color: (r) => profitColor(r.netProfit), render: (r) => money(r.netProfit) },
            ]}
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={2}>
            <DataTable
              title="Top products by gross profit"
              isLoading={isLoading}
              rows={data?.topProducts}
              rowKey={(r) => r.code + r.name}
              empty="No product sales in this period."
              columns={[
                { label: 'Product', render: (r) => r.name },
                { label: 'Gross profit', align: 'right', num: true, bold: true, render: (r) => money(r.grossProfit) },
                { label: 'Margin', align: 'right', num: true, render: (r) => `${r.marginPct}%` },
              ]}
            />
            <DataTable
              title="Expenses by category"
              isLoading={isLoading}
              rows={data?.byCategory}
              rowKey={(r) => r.category}
              empty="No expenses in this period."
              columns={[
                { label: 'Category', render: (r) => r.category },
                { label: 'Amount', align: 'right', num: true, bold: true, render: (r) => money(r.total) },
              ]}
            />
          </Stack>
        </Grid>
      </Grid>
      <NoteAlert>
        {data?.notes.basis}
        {s?.productsWithoutCost ? ` ${s.productsWithoutCost} product(s) have no purchase cost on file, so their profit is overstated.` : ''}
      </NoteAlert>
    </Stack>
  );
}
