import { Stack, Grid } from '@mui/material';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';

import { downloadCsv } from '../../../utils/exportCsv';
import { useOutstandingReportQuery } from '../../../api/financialReportsApi';
import {
  ReportHeader, FilterBar, StatRow, ErrorNote, DataTable, NoteAlert, useReportFilters, money, showDate,
} from './reportKit';

/** Outstanding (as of a date): customer balances with aging, and supplier receipts. */
export default function OutstandingReportPage() {
  const filters = useReportFilters();
  const {
    data, isLoading, isFetching, isError, error, refetch,
  } = useOutstandingReportQuery(filters.params);
  const s = data?.summary;

  const exportCsv = () => downloadCsv(
    `customer-outstanding_${data.asOf}.csv`,
    ['Bill no', 'Customer', 'Mobile', 'Date', 'Bill total', 'Paid', 'Balance', 'Age (days)'],
    data.bills.map((b) => [b.billNo, b.customer, b.mobile || '', b.date, b.total, b.paid, b.balance, b.ageDays]),
  );

  return (
    <Stack spacing={2}>
      <ReportHeader title="Outstanding" />
      <FilterBar filters={filters} showFrom={false} toLabel="As of" />
      <ErrorNote isError={isError} error={error} refetch={refetch} />
      <StatRow
        isLoading={isLoading}
        cards={[
          { icon: PersonOutlineOutlinedIcon, iconColor: '#E23E8C', label: 'Customer outstanding', value: s && money(s.customerOutstanding), caption: s && `${s.customersWithBalance} customer(s) · ${s.unpaidBills} bill(s)` },
          { icon: HourglassBottomOutlinedIcon, iconColor: '#E5484D', label: 'Over 60 days', value: s && money(s.over60Days), caption: 'Oldest unpaid balances' },
          { icon: LocalShippingOutlinedIcon, iconColor: '#2563EB', label: 'Supplier purchases received', value: s && money(s.supplierPayable), caption: 'Payments not tracked yet' },
          { icon: ReceiptLongOutlinedIcon, iconColor: '#F26B21', label: 'Unpaid bills', value: s && String(s.unpaidBills), caption: 'Credit / part-paid' },
        ]}
      />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={2}>
            <DataTable
              title="Customer aging"
              isLoading={isLoading}
              rows={data?.aging}
              rowKey={(r) => r.bucket}
              columns={[
                { label: 'Age', render: (r) => r.bucket },
                { label: 'Outstanding', align: 'right', num: true, bold: true, render: (r) => money(r.amount) },
              ]}
            />
            <DataTable
              title="By customer"
              isLoading={isLoading}
              rows={data?.customers}
              paged
              rowKey={(r) => r.customer + (r.mobile || '')}
              empty="No customer has an outstanding balance."
              columns={[
                { label: 'Customer', render: (r) => r.customer },
                { label: 'Bills', align: 'right', num: true, render: (r) => r.bills },
                { label: 'Oldest', align: 'right', num: true, render: (r) => `${r.oldestDays}d` },
                { label: 'Balance', align: 'right', num: true, bold: true, render: (r) => money(r.balance) },
              ]}
            />
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Stack spacing={2}>
            <DataTable
              title="Unpaid customer bills"
              isLoading={isLoading}
              dim={isFetching && !isLoading}
              rows={data?.bills}
              paged
              minWidth={560}
              onExport={exportCsv}
              rowKey={(r) => r.id}
              empty="No unpaid bills as of this date."
              columns={[
                { label: 'Bill', render: (r) => r.billNo, nowrap: true },
                { label: 'Customer', render: (r) => r.customer },
                { label: 'Date', render: (r) => showDate(r.date), nowrap: true },
                { label: 'Total', align: 'right', num: true, render: (r) => money(r.total) },
                { label: 'Balance', align: 'right', num: true, bold: true, render: (r) => money(r.balance) },
                { label: 'Age', align: 'right', num: true, render: (r) => `${r.ageDays}d` },
              ]}
            />
            <DataTable
              title="Suppliers — stock received"
              isLoading={isLoading}
              rows={data?.suppliers}
              rowKey={(r) => r.supplier}
              empty="No stock received from suppliers."
              columns={[
                { label: 'Supplier', render: (r) => r.supplier },
                { label: 'Receipts', align: 'right', num: true, render: (r) => r.receipts },
                { label: 'Value received', align: 'right', num: true, bold: true, render: (r) => money(r.payable) },
              ]}
            />
          </Stack>
        </Grid>
      </Grid>
      <NoteAlert>{data && `${data.notes.customers} ${data.notes.suppliers}`}</NoteAlert>
    </Stack>
  );
}
