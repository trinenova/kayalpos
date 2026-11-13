import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Stack, Box, Typography, Breadcrumbs, Link as MuiLink, Grid, Paper, Button, TextField, MenuItem, Alert, Skeleton,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, TablePagination, Chip, Tooltip,
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import PercentOutlinedIcon from '@mui/icons-material/PercentOutlined';

import StatCard from '../../../components/common/StatCard';
import { DatePickerField, formatPickerDate, parsePickerDate } from '../../../components/form/FormDatePicker';
import { formatCurrency } from '../../../utils/format';
import { downloadCsv } from '../../../utils/exportCsv';
import { useGrossProfitReportQuery, useGrossProfitFiltersQuery } from '../../../api/grossProfitApi';

const PAGE_SIZE = 10;

const money = (v) => formatCurrency(v ?? 0, { decimals: true });
const profitColor = (v) => (v < 0 ? 'error.main' : 'success.main');

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
 * Gross Profit report (Reports > Financial Reports > Gross Profit). Real data
 * from GET /api/gross-profit: net sales (excl. GST) minus cost of goods sold
 * (quantity x latest purchase cost), per product and per day.
 */
export default function GrossProfitReportPage() {
  const [draft, setDraft] = useState(defaultFilters);
  const [applied, setApplied] = useState(defaultFilters);
  const [page, setPage] = useState(0);

  const { data: options } = useGrossProfitFiltersQuery();
  const params = useMemo(() => ({
    from: toKey(applied.from),
    to: toKey(applied.to),
    outletId: applied.outletId || undefined,
  }), [applied]);
  const {
    data, isLoading, isFetching, isError, error, refetch,
  } = useGrossProfitReportQuery(params);

  const handleSearch = () => { setPage(0); setApplied(draft); };
  const handleReset = () => { const d = defaultFilters(); setDraft(d); setApplied(d); setPage(0); };

  const handleExport = () => {
    if (!data?.rows.length) return;
    downloadCsv(
      `gross-profit_${data.from}_${data.to}.csv`,
      ['Code', 'Product', 'Qty sold', 'Net sales', 'Unit cost', 'Cost', 'Gross profit', 'Margin %'],
      data.rows.map((r) => [r.code, r.name, r.qty, r.netSales, r.unitCost, r.cost, r.grossProfit, r.marginPct]),
    );
  };

  const summary = data?.summary;
  const pageRows = data?.rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE) || [];
  const errorMessage = error?.data?.message || 'Could not load the report.';

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Gross Profit</Typography>
        <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />} sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 12.5 } }}>
          <MuiLink component={RouterLink} to="/home" underline="hover" color="text.secondary">Home</MuiLink>
          <MuiLink component={RouterLink} to="/reports" underline="hover" color="text.secondary">Reports</MuiLink>
          <MuiLink component={RouterLink} to="/reports/financial" underline="hover" color="text.secondary">Financial Reports</MuiLink>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Gross Profit</Typography>
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
          { icon: ShoppingCartOutlinedIcon, iconColor: '#22A06B', label: 'Net sales', value: summary && money(summary.netSales), caption: 'Excl. GST, after discount' },
          { icon: Inventory2OutlinedIcon, iconColor: '#F26B21', label: 'Cost of goods sold', value: summary && money(summary.cost), caption: summary && `${summary.itemsSold} item(s) sold` },
          { icon: TrendingUpOutlinedIcon, iconColor: '#2563EB', label: 'Gross profit', value: summary && money(summary.grossProfit), caption: 'Net sales − cost' },
          { icon: PercentOutlinedIcon, iconColor: '#7C3AED', label: 'Gross margin', value: summary && `${summary.marginPct}%`, caption: summary && (summary.productsWithoutCost ? `${summary.productsWithoutCost} product(s) have no cost` : 'All products costed') },
        ].map((card) => (
          <Grid key={card.label} size={{ xs: 12, sm: 6, lg: 3 }}>
            {isLoading ? <Skeleton variant="rounded" height={92} /> : <StatCard icon={card.icon} iconColor={card.iconColor} label={card.label} value={card.value ?? '—'} caption={card.caption} />}
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', height: '100%' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, p: 2 }}>Daily trend</Typography>
            <TableContainer sx={{ maxHeight: 420 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell><TableCell align="right">Net sales</TableCell><TableCell align="right">Gross profit</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading && <TableRow><TableCell colSpan={3}><Skeleton height={32} /></TableCell></TableRow>}
                  {!isLoading && data?.trend.length === 0 && (
                    <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>No sales in this period.</TableCell></TableRow>
                  )}
                  {data?.trend.map((d) => (
                    <TableRow key={d.day} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{d.day.split('-').reverse().join('/')}</TableCell>
                      <Num>{money(d.netSales)}</Num>
                      <Num bold color={profitColor(d.grossProfit)}>{money(d.grossProfit)}</Num>
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
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Gross profit by product</Typography>
              <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} onClick={handleExport} disabled={!data?.rows.length} sx={{ minHeight: 44 }}>
                Export CSV
              </Button>
            </Stack>
            <TableContainer sx={{ opacity: isFetching && !isLoading ? 0.6 : 1 }}>
              <Table size="small" sx={{ minWidth: 760, '& td, & th': { py: 1.25 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Code</TableCell><TableCell>Product</TableCell>
                    <TableCell align="right">Qty sold</TableCell><TableCell align="right">Net sales</TableCell>
                    <TableCell align="right">Unit cost</TableCell><TableCell align="right">Cost</TableCell>
                    <TableCell align="right">Gross profit</TableCell><TableCell align="right">Margin</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading && Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={8}><Skeleton height={32} /></TableCell></TableRow>
                  ))}
                  {!isLoading && data?.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        No completed sales match these filters. Try widening the date range.
                      </TableCell>
                    </TableRow>
                  )}
                  {pageRows.map((r) => (
                    <TableRow key={r.productId || r.code} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.code || '—'}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <Num>{r.qty}</Num>
                      <Num>{money(r.netSales)}</Num>
                      <Num>
                        {r.noCost ? (
                          <Tooltip title="No purchase cost on file (Masters > Selling Price). Counted as 0.">
                            <Chip size="small" color="warning" label="No cost" />
                          </Tooltip>
                        ) : money(r.unitCost)}
                      </Num>
                      <Num>{money(r.cost)}</Num>
                      <Num bold color={profitColor(r.grossProfit)}>{money(r.grossProfit)}</Num>
                      <Num>{r.marginPct}%</Num>
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

      {data?.notes && (
        <Alert severity="info" variant="outlined">{data.notes.cost} {data.notes.returns}</Alert>
      )}
    </Stack>
  );
}
