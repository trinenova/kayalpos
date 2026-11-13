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

import StatCard from '../../../components/common/StatCard';
import { DatePickerField, formatPickerDate, parsePickerDate } from '../../../components/form/FormDatePicker';
import { formatCurrency } from '../../../utils/format';
import { useFinancialReportFiltersQuery } from '../../../api/financialReportsApi';

// Shared building blocks for the Financial Reports pages that follow the same
// layout: breadcrumb header, From/To/Outlet filter bar, stat cards, tables.
export const money = (v) => formatCurrency(v ?? 0, { decimals: true });
export const showDate = (key) => String(key).split('-').reverse().join('/');
export const label = (m) => String(m).charAt(0).toUpperCase() + String(m).slice(1).replace(/[-_]/g, ' ');
export const PAGE_SIZE = 10;

export function toKey(pickerValue) {
  const date = parsePickerDate(pickerValue);
  if (!date) return undefined;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function defaultFilters() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return { from: formatPickerDate(from), to: formatPickerDate(to), outletId: '' };
}

/** Draft/applied filter state + the query params derived from it. */
export function useReportFilters() {
  const [draft, setDraft] = useState(defaultFilters);
  const [applied, setApplied] = useState(defaultFilters);
  const params = useMemo(() => ({
    from: toKey(applied.from), to: toKey(applied.to), outletId: applied.outletId || undefined,
  }), [applied]);
  return {
    draft, setDraft, params, search: () => setApplied(draft), reset: () => { const d = defaultFilters(); setDraft(d); setApplied(d); },
  };
}

export const Num = ({ children, color, bold }) => (
  <TableCell align="right" sx={{ whiteSpace: 'nowrap', color: color || 'text.primary', fontWeight: bold ? 700 : 400 }}>{children}</TableCell>
);

export const profitColor = (v) => (v < 0 ? 'error.main' : 'success.main');

const lbl = { fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 };

export function ReportHeader({ title }) {
  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 800 }}>{title}</Typography>
      <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />} sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 12.5 } }}>
        <MuiLink component={RouterLink} to="/home" underline="hover" color="text.secondary">Home</MuiLink>
        <MuiLink component={RouterLink} to="/reports" underline="hover" color="text.secondary">Reports</MuiLink>
        <MuiLink component={RouterLink} to="/reports/financial" underline="hover" color="text.secondary">Financial Reports</MuiLink>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{title}</Typography>
      </Breadcrumbs>
    </Box>
  );
}

/** From / To / Outlet + Search / Reset. `showFrom={false}` for "as of" reports. */
export function FilterBar({ filters, showFrom = true, toLabel = 'To' }) {
  const { data: options } = useFinancialReportFiltersQuery();
  const { draft, setDraft } = filters;
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 2.5 } }}>
      <Grid container spacing={1.5} sx={{ alignItems: 'flex-end' }}>
        {showFrom && (
          <Grid size={{ xs: 6, md: 3 }}>
            <Typography variant="caption" sx={lbl}>From</Typography>
            <DatePickerField value={draft.from} onChange={(v) => setDraft((d) => ({ ...d, from: v }))} />
          </Grid>
        )}
        <Grid size={{ xs: showFrom ? 6 : 12, md: 3 }}>
          <Typography variant="caption" sx={lbl}>{toLabel}</Typography>
          <DatePickerField value={draft.to} onChange={(v) => setDraft((d) => ({ ...d, to: v }))} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
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
        <Grid size={{ xs: 12, md: 3 }}>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" startIcon={<SearchIcon fontSize="small" />} onClick={filters.search} fullWidth sx={{ minHeight: 48 }}>Search</Button>
            <Button variant="outlined" color="inherit" onClick={filters.reset} sx={{ minHeight: 48 }} aria-label="Reset filters"><CloseIcon fontSize="small" /></Button>
          </Stack>
        </Grid>
      </Grid>
    </Paper>
  );
}

export function StatRow({ cards, isLoading }) {
  return (
    <Grid container spacing={2}>
      {cards.map((card) => (
        <Grid key={card.label} size={{ xs: 12, sm: 6, lg: 12 / Math.min(cards.length, 4) }}>
          {isLoading
            ? <Skeleton variant="rounded" height={92} />
            : <StatCard icon={card.icon} iconColor={card.iconColor} label={card.label} value={card.value ?? '—'} caption={card.caption} />}
        </Grid>
      ))}
    </Grid>
  );
}

export function ErrorNote({ isError, error, refetch }) {
  if (!isError) return null;
  return (
    <Alert severity="error" action={<Button color="inherit" size="small" onClick={refetch}>Retry</Button>}>
      {error?.data?.message || 'Could not load the report.'}
    </Alert>
  );
}

/**
 * A titled table card. `columns` = [{ label, align?, render(row), key? }];
 * `rows` undefined while loading. Pages locally when `paged`; `onExport`
 * adds an Export CSV button.
 */
export function DataTable({
  title, columns, rows, isLoading, empty = 'Nothing to show for this period.', paged = false, onExport, rowKey, minWidth, maxHeight, dim,
}) {
  const [page, setPage] = useState(0);
  const shown = paged ? (rows || []).slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE) : rows || [];
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
      <Stack direction="row" sx={{ p: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
        {onExport && (
          <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} onClick={onExport} disabled={!rows?.length} sx={{ minHeight: 44 }}>
            Export CSV
          </Button>
        )}
      </Stack>
      <TableContainer sx={{ maxHeight, opacity: dim ? 0.6 : 1 }}>
        <Table size="small" stickyHeader={Boolean(maxHeight)} sx={{ minWidth, '& td, & th': { py: 1.25 } }}>
          <TableHead>
            <TableRow>{columns.map((c) => <TableCell key={c.label} align={c.align}>{c.label}</TableCell>)}</TableRow>
          </TableHead>
          <TableBody>
            {isLoading && Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={columns.length}><Skeleton height={30} /></TableCell></TableRow>
            ))}
            {!isLoading && rows?.length === 0 && (
              <TableRow><TableCell colSpan={columns.length} align="center" sx={{ py: 5, color: 'text.secondary' }}>{empty}</TableCell></TableRow>
            )}
            {shown.map((row, i) => (
              <TableRow key={rowKey ? rowKey(row) : i} hover>
                {columns.map((c) => (c.num
                  ? <Num key={c.label} bold={c.bold} color={c.color?.(row)}>{c.render(row)}</Num>
                  : <TableCell key={c.label} sx={{ whiteSpace: c.nowrap ? 'nowrap' : undefined }}>{c.render(row)}</TableCell>))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {paged && (
        <TablePagination
          component="div"
          count={rows?.length || 0}
          page={page}
          rowsPerPage={PAGE_SIZE}
          rowsPerPageOptions={[PAGE_SIZE]}
          onPageChange={(_, p) => setPage(p)}
        />
      )}
    </Paper>
  );
}

export function NoteAlert({ children }) {
  if (!children) return null;
  return <Alert severity="info" variant="outlined">{children}</Alert>;
}
