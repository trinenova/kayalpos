import { Stack, Grid } from '@mui/material';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';

import { downloadCsv } from '../../../utils/exportCsv';
import { usePaymentCollectionReportQuery } from '../../../api/financialReportsApi';
import {
  ReportHeader, FilterBar, StatRow, ErrorNote, DataTable, NoteAlert, useReportFilters, money, showDate, label,
} from './reportKit';

/** Payment Collection: money kept on completed bills by mode/day/cashier, less refunds. */
export default function PaymentCollectionReportPage() {
  const filters = useReportFilters();
  const {
    data, isLoading, isFetching, isError, error, refetch,
  } = usePaymentCollectionReportQuery(filters.params);
  const s = data?.summary;

  const exportCsv = () => downloadCsv(
    `payment-collection_${data.from}_${data.to}.csv`,
    ['Date', 'Bills', 'Cash', 'Card', 'UPI', 'Wallet', 'Other', 'Total collected', 'Refunds', 'Net'],
    data.daily.map((d) => [d.day, d.bills, d.cash, d.card, d.upi, d.wallet, d.other, d.total, d.refunds, d.net]),
  );

  return (
    <Stack spacing={2}>
      <ReportHeader title="Payment Collection" />
      <FilterBar filters={filters} />
      <ErrorNote isError={isError} error={error} refetch={refetch} />
      <StatRow
        isLoading={isLoading}
        cards={[
          { icon: ReceiptLongOutlinedIcon, iconColor: '#2563EB', label: 'Billed', value: s && money(s.billed), caption: s && `${s.bills} bill(s)` },
          { icon: PaymentsOutlinedIcon, iconColor: '#22A06B', label: 'Collected', value: s && money(s.collected), caption: s && `Not collected (credit) ${money(s.notCollected)}` },
          { icon: KeyboardReturnOutlinedIcon, iconColor: '#E5484D', label: 'Refunds paid', value: s && money(s.refunds), caption: 'On sales returns' },
          { icon: AccountBalanceWalletOutlinedIcon, iconColor: '#7C3AED', label: 'Net collection', value: s && money(s.netCollection), caption: 'Collected − refunds' },
        ]}
      />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={2}>
            <DataTable
              title="By payment mode"
              isLoading={isLoading}
              rows={data?.byMode}
              rowKey={(r) => r.mode}
              empty="No collections in this period."
              columns={[
                { label: 'Mode', render: (r) => label(r.mode) },
                { label: 'Bills', align: 'right', num: true, render: (r) => r.bills },
                { label: 'Collected', align: 'right', num: true, render: (r) => money(r.collected) },
                { label: 'Refunds', align: 'right', num: true, render: (r) => money(r.refunds) },
                { label: 'Net', align: 'right', num: true, bold: true, render: (r) => money(r.net) },
              ]}
            />
            <DataTable
              title="By cashier"
              isLoading={isLoading}
              rows={data?.byCashier}
              rowKey={(r) => r.cashier}
              empty="No collections in this period."
              columns={[
                { label: 'Cashier', render: (r) => r.cashier },
                { label: 'Bills', align: 'right', num: true, render: (r) => r.bills },
                { label: 'Collected', align: 'right', num: true, bold: true, render: (r) => money(r.collected) },
              ]}
            />
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          <DataTable
            title="Collection by day"
            isLoading={isLoading}
            dim={isFetching && !isLoading}
            rows={data?.daily}
            paged
            minWidth={680}
            onExport={exportCsv}
            rowKey={(r) => r.day}
            empty="No collections in this period."
            columns={[
              { label: 'Date', render: (r) => showDate(r.day), nowrap: true },
              { label: 'Cash', align: 'right', num: true, render: (r) => money(r.cash) },
              { label: 'Card', align: 'right', num: true, render: (r) => money(r.card) },
              { label: 'UPI', align: 'right', num: true, render: (r) => money(r.upi) },
              { label: 'Wallet', align: 'right', num: true, render: (r) => money(r.wallet) },
              { label: 'Other', align: 'right', num: true, render: (r) => money(r.other) },
              { label: 'Refunds', align: 'right', num: true, render: (r) => money(r.refunds) },
              { label: 'Net', align: 'right', num: true, bold: true, render: (r) => money(r.net) },
            ]}
          />
        </Grid>
      </Grid>
      <NoteAlert>{data?.notes.basis}</NoteAlert>
    </Stack>
  );
}
