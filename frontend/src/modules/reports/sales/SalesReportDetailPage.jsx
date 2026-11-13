import { useMemo, useState } from 'react';
import { useParams, Link as RouterLink, Navigate } from 'react-router-dom';
import {
  Stack, Box, Typography, Breadcrumbs, Link as MuiLink, Grid, Paper, Button, TextField, MenuItem, Alert, Skeleton,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, TablePagination,
  Dialog, DialogTitle, DialogContent, IconButton,
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
import { useSalesReportFiltersQuery } from '../../../api/salesReportsApi';
import { SALES_REPORT_DEFINITIONS } from './salesReportDefinitions';

const PAGE_SIZE = 20;

function toKey(pickerValue) {
  const date = parsePickerDate(pickerValue);
  if (!date) return undefined;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function defaultFilters(rangeDays = 30) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (rangeDays - 1));
  return {
    from: formatPickerDate(from), to: formatPickerDate(to), outletId: '', search: '',
  };
}

/**
 * Drill-down dialog for any report whose definition carries a `drillDown`
 * config (currently just Hourly Sales → items sold that hour). Generic over
 * `drillDown.useQuery`/`buildParams`/`columns`, same shape as the report's
 * own table, so adding a drill-down to another report needs no changes
 * here — just a `drillDown` block in that report's definition.
 */
function DrillDownDialog({ drillDown, row, baseParams, onClose }) {
  const params = row ? drillDown.buildParams(row, baseParams) : undefined;
  const { data, isLoading, isError } = drillDown.useQuery(params, { skip: !row });

  return (
    <Dialog open={Boolean(row)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{row ? drillDown.title(row) : ''}</Typography>
        <IconButton onClick={onClose} aria-label="Close" sx={{ width: 44, height: 44 }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading && <Skeleton variant="rounded" height={200} />}
        {isError && <Alert severity="error">Could not load this drill-down.</Alert>}
        {data && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {drillDown.columns.map((col) => (
                    <TableCell key={col.key} align={col.align || 'left'}>{col.label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {data.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={drillDown.columns.length} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      {drillDown.emptyMessage || 'No records found.'}
                    </TableCell>
                  </TableRow>
                )}
                {data.rows.map((r) => (
                  <TableRow key={r.id} hover>
                    {drillDown.columns.map((col) => (
                      <TableCell key={col.key} align={col.align || 'left'} sx={{ whiteSpace: 'nowrap' }}>
                        {col.render ? col.render(r) : r[col.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Generic Sales Report detail page — one shell (filters + summary tiles +
 * table + CSV export) reused for Hourly Sales, Payment-wise Sales, Discount
 * Report, Tax Report and Return Report (salesReportDefinitions.js), driven
 * by `reportKey` from the route (/reports/sales/:reportKey). Same shape as
 * InventoryReportDetailPage.jsx / CashierReportDetailPage.jsx, just with
 * outlet (no cashier) as the only non-date filter — none of these 5 reports
 * group by cashier.
 */
export default function SalesReportDetailPage() {
  const { reportKey } = useParams();
  const definition = SALES_REPORT_DEFINITIONS[reportKey];
  if (!definition) return <Navigate to="/reports/sales" replace />;
  // Remounts whenever reportKey changes, so each mount only ever calls one
  // fixed report's RTK Query hook — see InventoryReportDetailPage.jsx's
  // identical reasoning.
  return <SalesReportBody key={reportKey} definition={definition} />;
}

function SalesReportBody({ definition }) {
  const dispatch = useAppDispatch();

  const [draft, setDraft] = useState(() => defaultFilters(definition.defaultRangeDays));
  const [applied, setApplied] = useState(() => defaultFilters(definition.defaultRangeDays));
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [drillRow, setDrillRow] = useState(null);

  const { data: options } = useSalesReportFiltersQuery();

  const params = useMemo(() => ({
    from: toKey(applied.from),
    to: toKey(applied.to),
    outletId: applied.outletId || undefined,
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
    const d = defaultFilters(definition.defaultRangeDays);
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
          <MuiLink component={RouterLink} to="/reports/sales" underline="hover" color="text.secondary">Sales Reports</MuiLink>
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
          <Grid size={{ xs: 6, md: 2.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>Outlet</Typography>
            <TextField select fullWidth value={draft.outletId} onChange={(e) => setDraft((d) => ({ ...d, outletId: e.target.value }))} disabled={options && !options.canChooseOutlet}>
              <MenuItem value="">My outlet</MenuItem>
              {options?.canChooseOutlet && <MenuItem value="all">All outlets</MenuItem>}
              {options?.outlets.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>Search</Typography>
            <TextField fullWidth placeholder="Filter rows" value={draft.search} onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))} />
          </Grid>
          <Grid size={{ xs: 12, md: 2.5 }}>
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
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{definition.label}</Typography>
            {definition.drillDown && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Click a row to see the items sold</Typography>
            )}
          </Box>
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
                <TableRow
                  key={row.id}
                  hover
                  sx={definition.drillDown ? { cursor: 'pointer' } : undefined}
                  onClick={definition.drillDown ? () => setDrillRow(row) : undefined}
                >
                  {definition.columns.map((col) => (
                    <TableCell key={col.key} align={col.align || 'left'} sx={{ whiteSpace: 'nowrap' }}>
                      {col.render ? col.render(row) : row[col.key]}
                    </TableCell>
                  ))}
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

      {definition.drillDown && (
        <DrillDownDialog drillDown={definition.drillDown} row={drillRow} baseParams={params} onClose={() => setDrillRow(null)} />
      )}
    </Stack>
  );
}
