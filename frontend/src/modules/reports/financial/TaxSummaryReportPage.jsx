import { Stack, Grid } from '@mui/material';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';

import { downloadCsv } from '../../../utils/exportCsv';
import { useTaxSummaryReportQuery } from '../../../api/financialReportsApi';
import {
  ReportHeader, FilterBar, StatRow, ErrorNote, DataTable, NoteAlert, useReportFilters, money, showDate,
} from './reportKit';

/** Tax Summary: GST collected by rate/day, less returns, vs GST paid on purchases. */
export default function TaxSummaryReportPage() {
  const filters = useReportFilters();
  const {
    data, isLoading, isFetching, isError, error, refetch,
  } = useTaxSummaryReportQuery(filters.params);
  const s = data?.summary;

  const exportCsv = () => downloadCsv(
    `tax-summary_${data.from}_${data.to}.csv`,
    ['Date', 'Bills', 'Taxable value', 'GST collected'],
    data.daily.map((d) => [d.day, d.bills, d.taxable, d.tax]),
  );

  return (
    <Stack spacing={2}>
      <ReportHeader title="Tax Summary" />
      <FilterBar filters={filters} />
      <ErrorNote isError={isError} error={error} refetch={refetch} />
      <StatRow
        isLoading={isLoading}
        cards={[
          { icon: ShoppingCartOutlinedIcon, iconColor: '#22A06B', label: 'Taxable sales', value: s && money(s.taxableSales), caption: 'Value on which GST was charged' },
          { icon: ReceiptOutlinedIcon, iconColor: '#0EA5A4', label: 'GST collected (output)', value: s && money(s.outputTax), caption: 'On completed bills' },
          { icon: KeyboardReturnOutlinedIcon, iconColor: '#E5484D', label: 'GST on returns', value: s && money(s.returnsTax), caption: 'Reduces output tax' },
          { icon: AccountBalanceOutlinedIcon, iconColor: '#7C3AED', label: 'Net tax payable', value: s && money(s.netTaxPayable), caption: s && `After input tax ${money(s.inputTax)} (${s.receiptsCount} receipt(s))` },
        ]}
      />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <DataTable
            title="GST by tax rate"
            isLoading={isLoading}
            rows={data?.byRate}
            rowKey={(r) => r.ratePct}
            empty="No taxable sales in this period."
            columns={[
              { label: 'GST %', render: (r) => `${r.ratePct}%` },
              { label: 'Taxable', align: 'right', num: true, render: (r) => money(r.taxable) },
              { label: 'CGST', align: 'right', num: true, render: (r) => money(r.cgst) },
              { label: 'SGST', align: 'right', num: true, render: (r) => money(r.sgst) },
              { label: 'Total GST', align: 'right', num: true, bold: true, render: (r) => money(r.tax) },
            ]}
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          <DataTable
            title="GST by day"
            isLoading={isLoading}
            dim={isFetching && !isLoading}
            rows={data?.daily}
            paged
            onExport={exportCsv}
            rowKey={(r) => r.day}
            empty="No bills in this period."
            columns={[
              { label: 'Date', render: (r) => showDate(r.day), nowrap: true },
              { label: 'Bills', align: 'right', num: true, render: (r) => r.bills },
              { label: 'Taxable value', align: 'right', num: true, render: (r) => money(r.taxable) },
              { label: 'GST collected', align: 'right', num: true, bold: true, render: (r) => money(r.tax) },
            ]}
          />
        </Grid>
      </Grid>
      <NoteAlert>{data?.notes.basis}</NoteAlert>
    </Stack>
  );
}
