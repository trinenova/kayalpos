import { useMemo, useState } from 'react';
import { useParams, Link as RouterLink, Navigate } from 'react-router-dom';
import {
  Stack, Box, Typography, Breadcrumbs, Link as MuiLink, Grid, Paper, Button, TextField, MenuItem, Alert, Skeleton,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, TablePagination, Chip,
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';

import { useAppDispatch } from '../../../app/hooks';
import { showToast } from '../../../features/ui/uiSlice';
import StatCard from '../../../components/common/StatCard';
import { DatePickerField, formatPickerDate, parsePickerDate } from '../../../components/form/FormDatePicker';
import { downloadCsv } from '../../../utils/exportCsv';
import { useCashierReportFiltersQuery } from '../../../api/cashierReportsApi';
import { CASHIER_REPORT_DEFINITIONS } from './cashierReportDefinitions';

const PAGE_SIZE = 20;

function toKey(pickerValue) {
  const date = parsePickerDate(pickerValue);
  if (!date) return undefined;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function defaultFilters() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return {
    from: formatPickerDate(from), to: formatPickerDate(to), outletId: '', cashierId: '', search: '',
  };
}

function ReportChip({ map, value }) {
  const [label, color] = map[value] || [value, 'default'];
  return <Chip size="small" label={label} color={color} variant={color === 'default' ? 'outlined' : 'filled'} sx={{ fontWeight: 600 }} />;
}

/**
 * Generic Cashier Report detail page — one shell (filters + summary tiles +
 * table + CSV export) reused for Cashier Sales, Cash Collection and Cash
 * Shortage/Excess (cashierReportDefinitions.js), driven by `reportKey` from
 * the route (/reports/cashier/:reportKey). Shift-to-Shift Variance keeps its
 * own dedicated page/route (ShiftVarianceReportPage.jsx) since it already
 * existed and has its own drill-down dialog.
 */
export default function CashierReportDetailPage() {
  const { reportKey } = useParams();
  const definition = CASHIER_REPORT_DEFINITIONS[reportKey];
  if (!definition) return <Navigate to="/reports/cashier" replace />;
  // Remounts whenever reportKey changes, so each mount only ever calls one
  // fixed report's RTK Query hook — see InventoryReportDetailPage.jsx's
  // identical reasoning.
  return <CashierReportBody key={reportKey} definition={definition} />;
}

function CashierReportBody({ definition }) {
  const dispatch = useAppDispatch();

  const [draft, setDraft] = useState(defaultFilters);
  const [applied, setApplied] = useState(defaultFilters);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const { data: options } = useCashierReportFiltersQuery();

  const params = useMemo(() => ({
    from: toKey(applied.from),
    to: toKey(applied.to),
    outletId: applied.outletId || undefined,
    cashierId: applied.cashierId || undefined,
    search: applied.search || undefined,
    page,
    pageSize: PAGE_SIZE,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [applied, page]);

  const {
    data, isLoading, isFetching, isError, error, refetch,
  } = definition.useQuery(params);

  const handleSearch = () => { setPage(1); setApplied(draft); };
  const handleReset = () => {
    const d = defaultFilters();
    setDraft(d);
    setApplied(d);
    setPage(1);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = [];
      for (let p = 1; ; p += 1) {
        // eslint-disable-next-line no-await-in-loop
        const res = await dispatch(definition.endpoint.initiate({ ...params, page: p, pageSize: 200 }, { forceRefetch: true })).unwrap();
        rows.push(...res.rows);
        if (p >= res.totalPages) break;
      }
      downloadCsv(`${definition.exportName}_${params.from}_${params.to}.csv`, definition.exportHeaders, rows.map(definition.exportRow));
    } catch {
      dispatch(showToast('Could not export the report. Please try again.', 'error'));
    } finally {
      setExporting(false);
    }
  };

  const errorMessage = error?.data?.message || 'Could not load this report.';
  const summaryTiles = data?.summary ? definition.summaryTiles(data.summary) : [];

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>{definition.label}</Typography>
        <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />} sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 12.5 } }}>
          <MuiLink component={RouterLink} to="/home" underline="hover" color="text.secondary">Home</MuiLink>
          <MuiLink component={RouterLink} to="/reports" underline="hover" color="text.secondary">Reports</MuiLink>
          <MuiLink component={RouterLink} to="/reports/cashier" underline="hover" color="text.secondary">Cashier Reports</MuiLink>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{definition.label}</Typography>
        </Breadcrumbs>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>{definition.description}</Typography>
      </Box>

      <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 2.5 } }}>
        <Grid container spacing={1.5} sx={{ alignItems: 'flex-end' }}>
          <Grid size={{ xs: 6, md: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>From</Typography>
            <DatePickerField value={draft.from} onChange={(v) => setDraft((d) => ({ ...d, from: v }))} />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>To</Typography>
            <DatePickerField value={draft.to} onChange={(v) => setDraft((d) => ({ ...d, to: v }))} />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>Outlet</Typography>
            <TextField select fullWidth value={draft.outletId} onChange={(e) => setDraft((d) => ({ ...d, outletId: e.target.value }))} disabled={options && !options.canChooseOutlet}>
              <MenuItem value="">My outlet</MenuItem>
              {options?.canChooseOutlet && <MenuItem value="all">All outlets</MenuItem>}
              {options?.outlets.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>Cashier</Typography>
            <TextField select fullWidth value={draft.cashierId} onChange={(e) => setDraft((d) => ({ ...d, cashierId: e.target.value }))}>
              <MenuItem value="">All cashiers</MenuItem>
              {options?.cashiers.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 2.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>Search</Typography>
            <TextField fullWidth placeholder="Cashier or shift no." value={draft.search} onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))} />
          </Grid>
          <Grid size={{ xs: 12, md: 1.5 }}>
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
        {(isLoading ? Array.from({ length: definition.summaryTiles({}).length }) : summaryTiles).map((card, i) => (
          <Grid key={card?.label || i} size={{ xs: 12, sm: 6, lg: 3 }}>
            {isLoading || !card ? <Skeleton variant="rounded" height={92} /> : <StatCard icon={card.icon} iconColor={card.iconColor} label={card.label} value={card.value} />}
          </Grid>
        ))}
      </Grid>

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Stack direction="row" sx={{ p: 2, alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{definition.label}</Typography>
          <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} onClick={handleExport} disabled={exporting || !data?.total} sx={{ minHeight: 44 }}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        </Stack>
        <TableContainer sx={{ maxHeight: 640, opacity: isFetching && !isLoading ? 0.6 : 1 }}>
          <Table size="small" stickyHeader sx={{ minWidth: 960, '& td, & th': { py: 1.1 } }}>
            <TableHead>
              <TableRow>
                {definition.columns.map((col) => (
                  <TableCell key={col.key} align={col.align || 'left'}>{col.label}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={definition.columns.length}><Skeleton height={32} /></TableCell></TableRow>
              ))}
              {!isLoading && data?.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={definition.columns.length} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No records match these filters. Try widening the date range or clearing a filter.
                  </TableCell>
                </TableRow>
              )}
              {data?.rows.map((row) => (
                <TableRow key={row.id} hover>
                  {definition.columns.map((col) => {
                    const value = col.render ? col.render(row) : row[col.key];
                    return (
                      <TableCell key={col.key} align={col.align || 'left'} sx={{ whiteSpace: 'nowrap', color: col.color ? col.color(row) : 'text.primary' }}>
                        {col.chip ? <ReportChip map={col.chip} value={row[col.key]} /> : value}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={data?.total || 0}
          page={(data?.page || 1) - 1}
          rowsPerPage={PAGE_SIZE}
          rowsPerPageOptions={[PAGE_SIZE]}
          onPageChange={(_, p) => setPage(p + 1)}
        />
      </Paper>
    </Stack>
  );
}
