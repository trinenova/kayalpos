import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Stack, Box, Typography, Breadcrumbs, Link as MuiLink, Grid, Paper, Button, TextField, MenuItem, Alert, Skeleton,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, TablePagination, LinearProgress,
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';

import StatCard from '../../../components/common/StatCard';
import { DatePickerField, formatPickerDate, parsePickerDate } from '../../../components/form/FormDatePicker';
import { formatCurrency } from '../../../utils/format';
import { downloadCsv } from '../../../utils/exportCsv';
import { useExpenseReportQuery, useExpenseReportFiltersQuery } from '../../../api/expenseReportApi';

const PAGE_SIZE = 10;

const money = (v) => formatCurrency(v ?? 0, { decimals: true });
const showDate = (key) => key.split('-').reverse().join('/');
const label = (m) => String(m).charAt(0).toUpperCase() + String(m).slice(1).replace(/[-_]/g, ' ');

function toKey(pickerValue) {
  const date = parsePickerDate(pickerValue);
  if (!date) return undefined;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function defaultFilters() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return { from: formatPickerDate(from), to: formatPickerDate(to), outletId: '', category: '' };
}

const Num = ({ children, bold }) => (
  <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: bold ? 700 : 400 }}>{children}</TableCell>
);

const lbl = { fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 };

/**
 * Expense report (Reports > Financial Reports > Expenses). Real data from
 * GET /api/expense-report: the Expense rows logged on the Expenses page,
 * summarised by category, payment mode and day, plus the full list.
 */
export default function ExpenseReportPage() {
  const [draft, setDraft] = useState(defaultFilters);
  const [applied, setApplied] = useState(defaultFilters);
  const [page, setPage] = useState(0);

  const { data: options } = useExpenseReportFiltersQuery();
  const params = useMemo(() => ({
    from: toKey(applied.from),
    to: toKey(applied.to),
    outletId: applied.outletId || undefined,
    category: applied.category || undefined,
  }), [applied]);
  const {
    data, isLoading, isFetching, isError, error, refetch,
  } = useExpenseReportQuery(params);

  const handleSearch = () => { setPage(0); setApplied(draft); };
  const handleReset = () => { const d = defaultFilters(); setDraft(d); setApplied(d); setPage(0); };

  const handleExport = () => {
    if (!data?.rows.length) return;
    downloadCsv(
      `expenses_${data.from}_${data.to}.csv`,
      ['Reference', 'Date', 'Category', 'Description', 'Paid to', 'Payment mode', 'Amount', 'Tax', 'Total'],
      data.rows.map((r) => [r.referenceNo, r.date, r.category, r.description, r.paidToVendor, r.paymentMode, r.amount, r.tax, r.total]),
    );
  };

  const summary = data?.summary;
  const pageRows = data?.rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE) || [];
  const errorMessage = error?.data?.message || 'Could not load the report.';

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Expenses</Typography>
        <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />} sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 12.5 } }}>
          <MuiLink component={RouterLink} to="/home" underline="hover" color="text.secondary">Home</MuiLink>
          <MuiLink component={RouterLink} to="/reports" underline="hover" color="text.secondary">Reports</MuiLink>
          <MuiLink component={RouterLink} to="/reports/financial" underline="hover" color="text.secondary">Financial Reports</MuiLink>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Expenses</Typography>
        </Breadcrumbs>
      </Box>

      <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 2.5 } }}>
        <Grid container spacing={1.5} sx={{ alignItems: 'flex-end' }}>
          <Grid size={{ xs: 6, md: 2.5 }}>
            <Typography variant="caption" sx={lbl}>From</Typography>
            <DatePickerField value={draft.from} onChange={(v) => setDraft((d) => ({ ...d, from: v }))} />
          </Grid>
          <Grid size={{ xs: 6, md: 2.5 }}>
            <Typography variant="caption" sx={lbl}>To</Typography>
            <DatePickerField value={draft.to} onChange={(v) => setDraft((d) => ({ ...d, to: v }))} />
          </Grid>
          <Grid size={{ xs: 6, md: 2.5 }}>
            <Typography variant="caption" sx={lbl}>Outlet</Typography>
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
          <Grid size={{ xs: 6, md: 2.5 }}>
            <Typography variant="caption" sx={lbl}>Category</Typography>
            <TextField
              select
              fullWidth
              slotProps={{ select: { displayEmpty: true, SelectDisplayProps: { 'aria-label': 'Category filter' } } }}
              value={draft.category}
              onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            >
              <MenuItem value="">All categories</MenuItem>
              {options?.categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
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
      {data?.truncated && (
        <Alert severity="warning">Showing the latest 5000 expenses only. Narrow the date range for complete totals.</Alert>
      )}

      <Grid container spacing={2}>
        {[
          { icon: ReceiptLongOutlinedIcon, iconColor: '#F26B21', label: 'Total expenses', value: summary && money(summary.totalAmount), caption: summary && `${summary.count} expense(s) · avg ${money(summary.avgExpense)}` },
          { icon: PaymentsOutlinedIcon, iconColor: '#2563EB', label: 'Excluding tax', value: summary && money(summary.excludingTax), caption: 'Before tax' },
          { icon: ReceiptOutlinedIcon, iconColor: '#0EA5A4', label: 'Tax paid', value: summary && money(summary.tax), caption: 'Included in total' },
          { icon: CategoryOutlinedIcon, iconColor: '#7C3AED', label: 'Top category', value: summary ? (summary.topCategory || '—') : undefined, caption: data?.byCategory[0] ? `${money(data.byCategory[0].total)} · ${data.byCategory[0].sharePct}%` : '' },
        ].map((card) => (
          <Grid key={card.label} size={{ xs: 12, sm: 6, lg: 3 }}>
            {isLoading ? <Skeleton variant="rounded" height={92} /> : <StatCard icon={card.icon} iconColor={card.iconColor} label={card.label} value={card.value ?? '—'} caption={card.caption} />}
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, p: 2 }}>By category</Typography>
              <TableContainer sx={{ maxHeight: 360 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow><TableCell>Category</TableCell><TableCell align="right">Amount</TableCell><TableCell align="right">Share</TableCell></TableRow>
                  </TableHead>
                  <TableBody>
                    {isLoading && <TableRow><TableCell colSpan={3}><Skeleton height={32} /></TableCell></TableRow>}
                    {!isLoading && data?.byCategory.length === 0 && (
                      <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>No expenses in this period.</TableCell></TableRow>
                    )}
                    {data?.byCategory.map((c) => (
                      <TableRow key={c.category} hover>
                        <TableCell>
                          {c.category}
                          <LinearProgress variant="determinate" value={Math.min(c.sharePct, 100)} sx={{ mt: 0.5, height: 4, borderRadius: 2 }} />
                        </TableCell>
                        <Num bold>{money(c.total)}</Num>
                        <Num>{c.sharePct}%</Num>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, p: 2 }}>By payment mode</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow><TableCell>Mode</TableCell><TableCell align="right">Count</TableCell><TableCell align="right">Amount</TableCell></TableRow>
                  </TableHead>
                  <TableBody>
                    {data?.byPayment.map((p) => (
                      <TableRow key={p.mode} hover>
                        <TableCell>{label(p.mode)}</TableCell><Num>{p.count}</Num><Num bold>{money(p.total)}</Num>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <Stack direction="row" sx={{ p: 2, alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Expense details</Typography>
              <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} onClick={handleExport} disabled={!data?.rows.length} sx={{ minHeight: 44 }}>
                Export CSV
              </Button>
            </Stack>
            <TableContainer sx={{ opacity: isFetching && !isLoading ? 0.6 : 1 }}>
              <Table size="small" sx={{ minWidth: 820, '& td, & th': { py: 1.25 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Reference</TableCell><TableCell>Date</TableCell><TableCell>Category</TableCell>
                    <TableCell>Description</TableCell><TableCell>Paid to</TableCell><TableCell>Mode</TableCell>
                    <TableCell align="right">Amount</TableCell><TableCell align="right">Tax</TableCell><TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading && Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={9}><Skeleton height={32} /></TableCell></TableRow>
                  ))}
                  {!isLoading && data?.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        No expenses match these filters. Try widening the date range.
                      </TableCell>
                    </TableRow>
                  )}
                  {pageRows.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.referenceNo}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{showDate(r.date)}</TableCell>
                      <TableCell>{r.category}</TableCell>
                      <TableCell>{r.description}</TableCell>
                      <TableCell>{r.paidToVendor}</TableCell>
                      <TableCell>{label(r.paymentMode)}</TableCell>
                      <Num>{money(r.amount)}</Num>
                      <Num>{money(r.tax)}</Num>
                      <Num bold>{money(r.total)}</Num>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={data?.rows.length || 0}
              page={page}
              rowsPerPage={PAGE_SIZE}
              rowsPerPageOptions={[PAGE_SIZE]}
              onPageChange={(_, p) => setPage(p)}
            />
          </Paper>
        </Grid>
      </Grid>

      {data?.notes && <Alert severity="info" variant="outlined">{data.notes.basis}</Alert>}
    </Stack>
  );
}
