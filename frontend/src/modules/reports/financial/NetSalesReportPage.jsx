import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Stack, Box, Typography, Breadcrumbs, Link as MuiLink, Grid, Paper, Button, TextField, MenuItem, Alert, Skeleton,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, TablePagination,
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';

import StatCard from '../../../components/common/StatCard';
import { DatePickerField, formatPickerDate, parsePickerDate } from '../../../components/form/FormDatePicker';
import { formatCurrency } from '../../../utils/format';
import { downloadCsv } from '../../../utils/exportCsv';
import { useNetSalesReportQuery, useNetSalesFiltersQuery } from '../../../api/netSalesApi';

const PAGE_SIZE = 10;

const money = (v) => formatCurrency(v ?? 0, { decimals: true });
const showDate = (key) => key.split('-').reverse().join('/');
const modeLabel = (m) => m.charAt(0).toUpperCase() + m.slice(1).replace(/-/g, ' ');

function toKey(pickerValue) {
  const date = parsePickerDate(pickerValue);
  if (!date) return undefined;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function defaultFilters() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return { from: formatPickerDate(from), to: formatPickerDate(to), outletId: '' };
}

const Num = ({ children, color, bold }) => (
  <TableCell align="right" sx={{ whiteSpace: 'nowrap', color: color || 'text.primary', fontWeight: bold ? 700 : 400 }}>{children}</TableCell>
);

/**
 * Net Sales report (Reports > Financial Reports > Net Sales). Real data from
 * GET /api/net-sales: completed bills minus sales returns, per day and per
 * payment method.
 */
export default function NetSalesReportPage() {
  const [draft, setDraft] = useState(defaultFilters);
  const [applied, setApplied] = useState(defaultFilters);
  const [page, setPage] = useState(0);

  const { data: options } = useNetSalesFiltersQuery();
  const params = useMemo(() => ({
    from: toKey(applied.from),
    to: toKey(applied.to),
    outletId: applied.outletId || undefined,
  }), [applied]);
  const {
    data, isLoading, isFetching, isError, error, refetch,
  } = useNetSalesReportQuery(params);

  const handleSearch = () => { setPage(0); setApplied(draft); };
  const handleReset = () => { const d = defaultFilters(); setDraft(d); setApplied(d); setPage(0); };

  const handleExport = () => {
    if (!data?.daily.length) return;
    downloadCsv(
      `net-sales_${data.from}_${data.to}.csv`,
      ['Date', 'Bills', 'Gross sales', 'Discount', 'GST', 'Invoice total', 'Returns', 'Net sales'],
      data.daily.map((d) => [d.day, d.bills, d.gross, d.discount, d.tax, d.total, d.returns, d.netSales]),
    );
  };

  const summary = data?.summary;
  const pageRows = data?.daily.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE) || [];
  const errorMessage = error?.data?.message || 'Could not load the report.';

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Net Sales</Typography>
        <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />} sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 12.5 } }}>
          <MuiLink component={RouterLink} to="/home" underline="hover" color="text.secondary">Home</MuiLink>
          <MuiLink component={RouterLink} to="/reports" underline="hover" color="text.secondary">Reports</MuiLink>
          <MuiLink component={RouterLink} to="/reports/financial" underline="hover" color="text.secondary">Financial Reports</MuiLink>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Net Sales</Typography>
        </Breadcrumbs>
      </Box>

      <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 2.5 } }}>
        <Grid container spacing={1.5} sx={{ alignItems: 'flex-end' }}>
          <Grid size={{ xs: 6, md: 3 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>From</Typography>
            <DatePickerField value={draft.from} onChange={(v) => setDraft((d) => ({ ...d, from: v }))} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>To</Typography>
            <DatePickerField value={draft.to} onChange={(v) => setDraft((d) => ({ ...d, to: v }))} />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>Outlet</Typography>
            <TextField
              select
              fullWidth
              slotProps={{ select: { displayEmpty: true, SelectDisplayProps: { 'aria-label': 'Outlet filter' } } }}
              value={draft.outletId}
              onChange={(e) => setDraft((d) => ({ ...d, outletId: e.target.value }))}
              disabled={options && !options.canChooseOutlet}
            >
              <MenuItem value="">My outlet</MenuItem>
              {options?.canChooseOutlet && <MenuItem value="all">All outlets</MenuItem>}
              {options?.outlets.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" startIcon={<SearchIcon fontSize="small" />} onClick={handleSearch} fullWidth sx={{ minHeight: 48 }}>Search</Button>
              <Button variant="outlined" color="inherit" onClick={handleReset} sx={{ minHeight: 48 }} aria-label="Reset filters"><CloseIcon fontSize="small" /></Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {isError && (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={refetch}>Retry</Button>}>{errorMessage}</Alert>
      )}

      <Grid container spacing={2}>
        {[
          { icon: ReceiptLongOutlinedIcon, iconColor: '#2563EB', label: 'Invoice total', value: summary && money(summary.total), caption: summary && `${summary.bills} bill(s) · avg ${money(summary.avgBill)}` },
          { icon: KeyboardReturnOutlinedIcon, iconColor: '#E5484D', label: 'Sales returns', value: summary && money(summary.returns), caption: 'Dated in this period' },
          { icon: ShoppingCartOutlinedIcon, iconColor: '#22A06B', label: 'Net sales', value: summary && money(summary.netSales), caption: 'Invoice total − returns' },
          { icon: TrendingUpOutlinedIcon, iconColor: '#7C3AED', label: 'Gross sales', value: summary && money(summary.gross), caption: summary && `Discount ${money(summary.discount)} · GST ${money(summary.tax)}` },
        ].map((card) => (
          <Grid key={card.label} size={{ xs: 12, sm: 6, lg: 3 }}>
            {isLoading ? <Skeleton variant="rounded" height={92} /> : <StatCard icon={card.icon} iconColor={card.iconColor} label={card.label} value={card.value ?? '—'} caption={card.caption} />}
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', height: '100%' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, p: 2 }}>By payment method</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Method</TableCell><TableCell align="right">Bills</TableCell><TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading && <TableRow><TableCell colSpan={3}><Skeleton height={32} /></TableCell></TableRow>}
                  {!isLoading && data?.byPayment.length === 0 && (
                    <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>No sales in this period.</TableCell></TableRow>
                  )}
                  {data?.byPayment.map((p) => (
                    <TableRow key={p.mode} hover>
                      <TableCell>{modeLabel(p.mode)}</TableCell>
                      <Num>{p.bills}</Num>
                      <Num bold>{money(p.total)}</Num>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <Stack direction="row" sx={{ p: 2, alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Net sales by day</Typography>
              <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} onClick={handleExport} disabled={!data?.daily.length} sx={{ minHeight: 44 }}>
                Export CSV
              </Button>
            </Stack>
            <TableContainer sx={{ opacity: isFetching && !isLoading ? 0.6 : 1 }}>
              <Table size="small" sx={{ minWidth: 720, '& td, & th': { py: 1.25 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell><TableCell align="right">Bills</TableCell>
                    <TableCell align="right">Gross sales</TableCell><TableCell align="right">Discount</TableCell>
                    <TableCell align="right">GST</TableCell><TableCell align="right">Invoice total</TableCell>
                    <TableCell align="right">Returns</TableCell><TableCell align="right">Net sales</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading && Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={8}><Skeleton height={32} /></TableCell></TableRow>
                  ))}
                  {!isLoading && data?.daily.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        No completed sales match these filters. Try widening the date range.
                      </TableCell>
                    </TableRow>
                  )}
                  {pageRows.map((d) => (
                    <TableRow key={d.day} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{showDate(d.day)}</TableCell>
                      <Num>{d.bills}</Num>
                      <Num>{money(d.gross)}</Num>
                      <Num>{money(d.discount)}</Num>
                      <Num>{money(d.tax)}</Num>
                      <Num>{money(d.total)}</Num>
                      <Num color={d.returns > 0 ? 'error.main' : undefined}>{money(d.returns)}</Num>
                      <Num bold>{money(d.netSales)}</Num>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={data?.daily.length || 0}
              page={page}
              rowsPerPage={PAGE_SIZE}
              rowsPerPageOptions={[PAGE_SIZE]}
              onPageChange={(_, p) => setPage(p)}
            />
          </Paper>
        </Grid>
      </Grid>

      {data?.notes && <Alert severity="info" variant="outlined">{data.notes.net}</Alert>}
    </Stack>
  );
}
