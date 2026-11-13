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
import { useInventoryReportFiltersQuery } from '../../../api/inventoryReportsApi';
import { INVENTORY_REPORT_DEFINITIONS } from './inventoryReportDefinitions';

const PAGE_SIZE = 20;

function toKey(pickerValue) {
  const date = parsePickerDate(pickerValue);
  if (!date) return undefined;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function defaultFilters(rangeDays) {
  const to = new Date();
  const from = new Date();
  if (rangeDays) from.setDate(from.getDate() - (rangeDays - 1));
  return {
    from: formatPickerDate(from),
    to: formatPickerDate(to),
    outletId: '',
    warehouseId: '',
    warehouseName: '',
    status: 'all',
    type: 'all',
    search: '',
  };
}

function ReportChip({ map, value }) {
  const [label, color] = map[value] || [value, 'default'];
  return <Chip size="small" label={label} color={color} variant={color === 'default' ? 'outlined' : 'filled'} sx={{ fontWeight: 600 }} />;
}

/**
 * Generic Inventory Report detail page — one shell (filters + summary tiles
 * + table + CSV export) reused for all 11 report types in
 * inventoryReportDefinitions.js, driven entirely by `reportKey` from the
 * route (/reports/inventory/:reportKey). Each definition supplies its own
 * RTK Query hook, filter set, columns and export shape; this component never
 * knows the specifics of any one report.
 */
export default function InventoryReportDetailPage() {
  const { reportKey } = useParams();
  const definition = INVENTORY_REPORT_DEFINITIONS[reportKey];
  if (!definition) return <Navigate to="/reports/inventory" replace />;
  // Remounts the body whenever the route's reportKey changes, so each mount
  // deals with exactly one fixed `definition` — the only safe way to pick
  // one of 11 different RTK Query hooks per report without varying the
  // number of hooks called across renders of the same instance.
  return <InventoryReportBody key={reportKey} definition={definition} />;
}

function InventoryReportBody({ definition }) {
  const dispatch = useAppDispatch();

  const [draft, setDraft] = useState(() => defaultFilters(definition.defaultRangeDays));
  const [applied, setApplied] = useState(() => defaultFilters(definition.defaultRangeDays));
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const hasFilter = (name) => definition.filters.includes(name);
  const { data: options } = useInventoryReportFiltersQuery();

  const params = useMemo(() => {
    const p = { page, pageSize: PAGE_SIZE };
    if (applied.search) p.search = applied.search;
    if (hasFilter('dateRange')) { p.from = toKey(applied.from); p.to = toKey(applied.to); }
    if (hasFilter('outlet') && applied.outletId) p.outletId = applied.outletId;
    if (hasFilter('warehouseId') && applied.warehouseId) p.warehouseId = applied.warehouseId;
    if (hasFilter('warehouseName') && applied.warehouseName) p.warehouse = applied.warehouseName;
    if (hasFilter('expiryStatus')) p.status = applied.status;
    if (hasFilter('type')) p.type = applied.type;
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied, page]);

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
      downloadCsv(`${definition.exportName}_${params.from || ''}_${params.to || ''}.csv`.replace(/^_+/, '').replace(/_+\.csv$/, '.csv'), definition.exportHeaders, rows.map(definition.exportRow));
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
          <MuiLink component={RouterLink} to="/reports/inventory" underline="hover" color="text.secondary">Inventory Reports</MuiLink>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{definition.label}</Typography>
        </Breadcrumbs>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>{definition.description}</Typography>
      </Box>

      <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 2.5 } }}>
        <Grid container spacing={1.5} sx={{ alignItems: 'flex-end' }}>
          {hasFilter('dateRange') && (
            <>
              <Grid size={{ xs: 6, md: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>From</Typography>
                <DatePickerField value={draft.from} onChange={(v) => setDraft((d) => ({ ...d, from: v }))} />
              </Grid>
              <Grid size={{ xs: 6, md: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>To</Typography>
                <DatePickerField value={draft.to} onChange={(v) => setDraft((d) => ({ ...d, to: v }))} />
              </Grid>
            </>
          )}
          {hasFilter('outlet') && (
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>Outlet</Typography>
              <TextField select fullWidth value={draft.outletId} onChange={(e) => setDraft((d) => ({ ...d, outletId: e.target.value }))} disabled={options && !options.canChooseOutlet}>
                <MenuItem value="">My outlet</MenuItem>
                {options?.canChooseOutlet && <MenuItem value="all">All outlets</MenuItem>}
                {options?.outlets.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
              </TextField>
            </Grid>
          )}
          {hasFilter('warehouseId') && (
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>Warehouse</Typography>
              <TextField select fullWidth value={draft.warehouseId} onChange={(e) => setDraft((d) => ({ ...d, warehouseId: e.target.value }))}>
                <MenuItem value="">All warehouses</MenuItem>
                {options?.warehouses.map((w) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
              </TextField>
            </Grid>
          )}
          {hasFilter('warehouseName') && (
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>Warehouse</Typography>
              <TextField select fullWidth value={draft.warehouseName} onChange={(e) => setDraft((d) => ({ ...d, warehouseName: e.target.value }))}>
                <MenuItem value="">All warehouses</MenuItem>
                {options?.warehouses.map((w) => <MenuItem key={w.id} value={w.name}>{w.name}</MenuItem>)}
              </TextField>
            </Grid>
          )}
          {hasFilter('expiryStatus') && (
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>Status</Typography>
              <TextField select fullWidth value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}>
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="expired">Expired</MenuItem>
                <MenuItem value="expiring-soon">Expiring soon (30 days)</MenuItem>
                <MenuItem value="active">Active</MenuItem>
              </TextField>
            </Grid>
          )}
          {hasFilter('type') && (
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>Movement</Typography>
              <TextField select fullWidth value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}>
                {definition.typeOptions.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </TextField>
            </Grid>
          )}
          <Grid size={{ xs: 12, md: 2.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>Search</Typography>
            <TextField fullWidth placeholder="Item code or name" value={draft.search} onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))} />
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

      <Grid container spacing={2}>
        {(isLoading ? Array.from({ length: definition.summaryTiles({}).length }) : summaryTiles).map((card, i) => (
          <Grid key={card?.label || i} size={{ xs: 12, sm: 6, lg: 12 / Math.max(summaryTiles.length || 3, 3) }}>
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
