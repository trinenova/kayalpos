import { useMemo, useState } from 'react';
import { Link as RouterLink, Navigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Stack, Box, Typography, Breadcrumbs, Link as MuiLink, Grid, Paper, Button, TextField, MenuItem, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, TableFooter, TablePagination, Alert, Skeleton, InputAdornment,
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';

import { useAppDispatch } from '../../../app/hooks';
import { showToast } from '../../../features/ui/uiSlice';
import { formatCurrency } from '../../../utils/format';
import { downloadWorkbook, datedFileName } from '../../../utils/excel';
import { useSalesSummaryReportQuery, useSalesReportFiltersQuery } from '../../../api/salesReportsApi';
import {
  SALES_REPORTS, todayIso, formatDisplayDate, datePresets, rowLabel,
} from './salesReportConfig';

const money = (v) => formatCurrency(Number(v) || 0, { decimals: true });
const PLURAL = {
  'Item Name': 'Items', Category: 'Categories', Brand: 'Brands', Outlet: 'Outlets', Cashier: 'Cashiers', Customer: 'Customers',
};
const qtyFmt = (v) => (Number(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

function StatTile({ label, value, color }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, p: 2, minHeight: 74 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>{label}</Typography>
      <Typography variant="h6" sx={{ fontWeight: 800, color: color || 'text.primary', mt: 0.25 }}>{value}</Typography>
    </Paper>
  );
}

/** Table columns for a report: { id, label, align, value(row) -> text, total(summary) -> text, num? } */
function buildColumns(config) {
  const cols = [];
  if (config.api === 'item') {
    cols.push(
      { id: 'code', label: 'Item Code', value: (r) => r.code },
      { id: 'name', label: 'Item Name', value: (r) => r.label },
      { id: 'category', label: 'Category', value: (r) => r.category || '—' },
      { id: 'brand', label: 'Brand', value: (r) => r.brand || '—' },
    );
  } else {
    cols.push({ id: 'label', label: config.rowLabel, value: (r) => rowLabel(config, r) });
    if (config.extra) cols.push({ id: 'extra', label: config.extraLabel, value: (r) => r[config.extra] || '—' });
  }
  cols.push(
    { id: 'bills', label: 'Bills', align: 'right', value: (r) => r.bills, total: (s) => s.bills, raw: (r) => r.bills, rawTotal: (s) => s.bills },
    { id: 'qty', label: 'Qty Sold', align: 'right', value: (r) => qtyFmt(r.qty), total: (s) => qtyFmt(s.qty), raw: (r) => r.qty, rawTotal: (s) => s.qty },
    { id: 'gross', label: 'Gross', align: 'right', value: (r) => money(r.gross), total: (s) => money(s.gross), raw: (r) => r.gross, rawTotal: (s) => s.gross },
    { id: 'discount', label: 'Discount', align: 'right', value: (r) => money(r.discount), total: (s) => money(s.discount), raw: (r) => r.discount, rawTotal: (s) => s.discount },
    { id: 'tax', label: 'Tax', align: 'right', value: (r) => money(r.tax), total: (s) => money(s.tax), raw: (r) => r.tax, rawTotal: (s) => s.tax },
    { id: 'sales', label: 'Sales', align: 'right', value: (r) => money(r.sales), total: (s) => money(s.sales), bold: true, raw: (r) => r.sales, rawTotal: (s) => s.sales },
    { id: 'returns', label: 'Returns', align: 'right', value: (r) => money(r.returns), total: (s) => money(s.returns), raw: (r) => r.returns, rawTotal: (s) => s.returns },
    { id: 'net', label: 'Net Sales', align: 'right', value: (r) => money(r.net), total: (s) => money(s.net), bold: true, raw: (r) => r.net, rawTotal: (s) => s.net },
  );
  if (config.kind === 'bill') {
    cols.push({ id: 'avgBill', label: 'Avg Bill', align: 'right', value: (r) => money(r.avgBill), total: (s) => money(s.avgBill), raw: (r) => r.avgBill, rawTotal: (s) => s.avgBill });
  }
  cols.push({ id: 'share', label: 'Share %', align: 'right', value: (r) => `${(r.share || 0).toFixed(1)}%`, total: (s) => (s.sales > 0 ? '100.0%' : '0.0%'), raw: (r) => r.share || 0, rawTotal: (s) => (s.sales > 0 ? 100 : 0) });
  return cols;
}

/**
 * One real Sales Report (Daily / Monthly / Outlet-wise / Cashier-wise /
 * Item-wise / Category-wise / Brand-wise / Customer-wise), reached from the
 * Sales Reports landing tiles at /reports/sales/:report. Filters live in the
 * URL (?from&to&outletId&cashier&search) so a report can be refreshed,
 * bookmarked and opened from the landing screen with its filters carried over.
 */
export default function SalesSummaryReportPage() {
  const { reportKey: slug } = useParams();
  const config = SALES_REPORTS[slug];
  const dispatch = useAppDispatch();
  const [params, setParams] = useSearchParams();

  const today = todayIso();
  const applied = {
    from: params.get('from') || today,
    to: params.get('to') || params.get('from') || today,
    outletId: params.get('outletId') || '',
    cashier: params.get('cashier') || '',
    search: params.get('search') || '',
  };

  // Draft = what's typed in the filter bar; only "Search" applies it.
  const [draft, setDraft] = useState(applied);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const { data: filterData } = useSalesReportFiltersQuery();
  const outlets = filterData?.outlets || [];
  const cashiers = filterData?.cashiers || [];
  // Only ADMIN may look across outlets; everyone else is fixed to their own
  // outlet (the server enforces the same rule).
  const canChooseOutlet = filterData?.canChooseOutlet !== false;

  const queryArgs = {
    report: config?.api,
    from: applied.from,
    to: applied.to,
    outletId: applied.outletId || 'all',
    ...(applied.cashier ? { cashier: applied.cashier } : {}),
    ...(applied.search ? { search: applied.search } : {}),
  };
  const {
    data, isLoading, isFetching, isError, error, refetch,
  } = useSalesSummaryReportQuery(queryArgs, { skip: !config });

  const columns = useMemo(() => (config ? buildColumns(config) : []), [config]);

  if (!config) return <Navigate to="/reports/sales" replace />;

  const dateError = draft.from && draft.to && draft.from > draft.to ? '"To" date cannot be before "From" date' : '';
  const setField = (field) => (e) => setDraft((d) => ({ ...d, [field]: e.target.value }));

  const handleSearch = () => {
    if (dateError || !draft.from || !draft.to) return;
    const next = {};
    Object.entries(draft).forEach(([k, v]) => { if (v) next[k] = v; });
    setParams(next, { replace: true });
    setPage(0);
  };
  const handleReset = () => {
    const fresh = {
      from: today, to: today, outletId: '', cashier: '', search: '',
    };
    setDraft(fresh);
    setParams({}, { replace: true });
    setPage(0);
  };
  const applyPreset = (preset) => {
    const next = { ...draft, from: preset.from, to: preset.to };
    setDraft(next);
    const q = {};
    Object.entries(next).forEach(([k, v]) => { if (v) q[k] = v; });
    setParams(q, { replace: true });
    setPage(0);
  };

  const rows = data?.rows || [];
  const summary = data?.summary;
  const outletName = canChooseOutlet ? outlets.find((o) => o.id === applied.outletId)?.name : outlets[0]?.name;

  const handleExport = () => {
    if (!rows.length) {
      dispatch(showToast('Nothing to export for the selected filters', 'info'));
      return;
    }
    const exportable = columns.map((c) => c.label);
    // Numbers (not formatted text) so the sheet can be summed / sorted in Excel.
    const body = rows.map((r) => columns.map((c) => (c.raw ? c.raw(r) : c.value(r))));
    const totalRow = columns.map((c, i) => (i === 0 ? 'Total' : (c.rawTotal ? c.rawTotal(summary) : '')));
    downloadWorkbook(datedFileName(config.title.replace(/[^A-Za-z]+/g, '_')), [
      { name: config.title.slice(0, 31), rows: [exportable, ...body, totalRow] },
      {
        name: 'Filters',
        rows: [
          ['Report', config.title],
          ['From', formatDisplayDate(applied.from)],
          ['To', formatDisplayDate(applied.to)],
          ['Outlet', outletName || 'All Outlets'],
          ['Cashier', applied.cashier || 'All Cashiers'],
          ['Search', applied.search || ''],
        ],
      },
    ]);
  };

  // Chart: time reports show everything in order; ranked reports show the top 10.
  const isTime = config.api === 'daily' || config.api === 'monthly';
  const series = (data?.series || []);
  const chartSeries = isTime ? series : series.slice(0, 10);
  const chartLabels = chartSeries.map((p) => (config.api === 'daily' ? formatDisplayDate(p.label).slice(0, 5) : (config.api === 'monthly' ? rowLabel(config, { month: p.label }) : p.label)));
  const chartData = chartSeries.map((p) => p.sales);

  const pageRows = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const rangeText = applied.from === applied.to ? formatDisplayDate(applied.from) : `${formatDisplayDate(applied.from)} – ${formatDisplayDate(applied.to)}`;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>{config.title}</Typography>
          <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />} sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 12.5 } }}>
            <MuiLink component={RouterLink} to="/home" underline="hover" color="text.secondary">Home</MuiLink>
            <MuiLink component={RouterLink} to="/reports" underline="hover" color="text.secondary">Reports</MuiLink>
            <MuiLink component={RouterLink} to="/reports/sales" underline="hover" color="text.secondary">Sales Reports</MuiLink>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{config.title}</Typography>
          </Breadcrumbs>
        </Box>
        <Button variant="outlined" color="inherit" startIcon={<FileDownloadOutlinedIcon fontSize="small" />} onClick={handleExport} disabled={isLoading || !rows.length}>
          Export Excel
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 2.5 } }}>
        <Grid container spacing={1.5} sx={{ alignItems: 'flex-start' }}>
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField label="From" type="date" value={draft.from} onChange={setField('from')} fullWidth slotProps={{ inputLabel: { shrink: true } }} error={Boolean(dateError)} />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField label="To" type="date" value={draft.to} onChange={setField('to')} fullWidth slotProps={{ inputLabel: { shrink: true } }} error={Boolean(dateError)} helperText={dateError} />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField
              select
              label="Outlet"
              value={canChooseOutlet ? draft.outletId : (outlets[0]?.id || '')}
              onChange={setField('outletId')}
              disabled={!canChooseOutlet}
              fullWidth
            >
              {canChooseOutlet ? <MenuItem value="">All Outlets</MenuItem> : null}
              {outlets.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField select label="Cashier" value={draft.cashier} onChange={setField('cashier')} fullWidth>
              <MenuItem value="">All Cashiers</MenuItem>
              {cashiers.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Grid>
          {config.search ? (
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField
                label={`Find ${config.rowLabel.toLowerCase()}`}
                value={draft.search}
                onChange={setField('search')}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                fullWidth
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
              />
            </Grid>
          ) : null}
          <Grid size={{ xs: 6, md: 1 }}>
            <Button variant="contained" onClick={handleSearch} disabled={Boolean(dateError)} fullWidth sx={{ height: 56 }}>Search</Button>
          </Grid>
          <Grid size={{ xs: 6, md: 1 }}>
            <Button variant="outlined" color="inherit" startIcon={<CloseIcon fontSize="small" />} onClick={handleReset} fullWidth sx={{ height: 56 }}>Reset</Button>
          </Grid>
        </Grid>
        <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1.5, flexWrap: 'wrap' }}>
          {datePresets().map((p) => (
            <Chip
              key={p.label}
              size="small"
              clickable
              label={p.label}
              variant={applied.from === p.from && applied.to === p.to ? 'filled' : 'outlined'}
              color={applied.from === p.from && applied.to === p.to ? 'primary' : 'default'}
              onClick={() => applyPreset(p)}
            />
          ))}
        </Stack>
      </Paper>

      {isError ? (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={refetch}>Retry</Button>}>
          {error?.data?.message
            ? `${error.data.message}${error.data.details ? ` — ${Object.values(error.data.details).flat().join(', ')}` : ''}`
            : 'Failed to load the report.'}
        </Alert>
      ) : null}

      <Grid container spacing={2}>
        {[
          ['Total Sales', summary && money(summary.sales), 'primary.main'],
          ['Returns', summary && money(summary.returns), 'error.main'],
          ['Net Sales', summary && money(summary.net), 'success.main'],
          ['Bills', summary && summary.bills],
          ['Items Sold', summary && qtyFmt(summary.qty)],
          ['Avg Bill Value', summary && money(summary.avgBill)],
        ].map(([label, value, color]) => (
          <Grid key={label} size={{ xs: 6, md: 4, lg: 2 }}>
            {isLoading ? <Skeleton variant="rounded" height={74} /> : <StatTile label={label} value={value ?? '—'} color={color} />}
          </Grid>
        ))}
      </Grid>

      <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 2.5 } }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {isTime ? 'Sales Trend' : `Top ${PLURAL[config.rowLabel] || config.rowLabel} by Sales`}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {rangeText}{outletName ? ` · ${outletName}` : ''}{applied.cashier ? ` · ${applied.cashier}` : ''}
          </Typography>
        </Stack>
        {isLoading ? <Skeleton variant="rounded" height={260} /> : chartData.length === 0 || chartData.every((v) => !v) ? (
          <Box sx={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>No sales in this period.</Typography>
          </Box>
        ) : config.chart === 'line' ? (
          <LineChart height={280} xAxis={[{ scaleType: 'point', data: chartLabels }]} series={[{ data: chartData, label: 'Sales (₹)', area: true }]} />
        ) : (
          <BarChart height={280} xAxis={[{ scaleType: 'band', data: chartLabels }]} series={[{ data: chartData, label: 'Sales (₹)' }]} />
        )}
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', opacity: isFetching && !isLoading ? 0.6 : 1 }}>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 980 }}>
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap', bgcolor: 'rgba(242,107,33,0.10)' } }}>
                <TableCell sx={{ width: 48 }}>#</TableCell>
                {columns.map((c) => <TableCell key={c.id} align={c.align}>{c.label}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={columns.length + 1}><Skeleton /></TableCell></TableRow>
                ))
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    No sales found for the selected filters.
                  </TableCell>
                </TableRow>
              ) : pageRows.map((row, i) => (
                <TableRow key={row.key} hover>
                  <TableCell sx={{ color: 'text.secondary' }}>{page * rowsPerPage + i + 1}</TableCell>
                  {columns.map((c) => (
                    <TableCell key={c.id} align={c.align} sx={{ whiteSpace: 'nowrap', fontWeight: c.bold ? 700 : 400, color: c.id === 'returns' && row.returns > 0 ? 'error.main' : undefined }}>
                      {c.value(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
            {summary && rows.length > 0 ? (
              <TableFooter>
                <TableRow sx={{ '& td': { fontWeight: 800, bgcolor: 'rgba(0,0,0,0.03)', whiteSpace: 'nowrap' } }}>
                  <TableCell />
                  {columns.map((c, i) => (
                    <TableCell key={c.id} align={c.align}>{i === 0 ? `Total (${rows.length})` : (c.total ? c.total(summary) : '')}</TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            ) : null}
          </Table>
        </Box>
        <TablePagination
          component="div"
          count={rows.length}
          page={Math.min(page, Math.max(Math.ceil(rows.length / rowsPerPage) - 1, 0))}
          onPageChange={(_e, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>
    </Stack>
  );
}
