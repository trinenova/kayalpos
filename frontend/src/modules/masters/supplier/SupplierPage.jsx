import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Stack, Box, Typography, Breadcrumbs, Link as MuiLink, Grid, Paper, Button,
  TextField, MenuItem, InputAdornment, Pagination,
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import AddIcon from '@mui/icons-material/Add';
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import StorefrontIcon from '@mui/icons-material/Storefront';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';

import { useAppDispatch } from '../../../app/hooks';
import { showToast } from '../../../features/ui/uiSlice';
import StatCard from '../../../components/common/StatCard';
import { formatNumber, formatCurrency } from '../../../utils/format';

import SupplierTable from './components/SupplierTable';
import SupplierFormDialog from './components/SupplierFormDialog';
import SupplierViewDialog from './components/SupplierViewDialog';
import ExcelImportDialog from '../../../components/common/ExcelImportDialog';
import { downloadSupplierTemplate, parseSupplierRows, exportSuppliers } from './supplierExcel';
import { useImportSuppliersMutation } from '../../../api/supplierApi';
import { SUPPLIER_GROUP_OPTIONS, CITY_OPTIONS, STATE_OPTIONS } from './supplierMockData';
import { useGetSuppliersQuery, useDeleteSupplierMutation } from '../../../api/supplierApi';

// Maps a Supplier row as returned by the API (status: 'ACTIVE'/'INACTIVE')
// to the shape the existing table/dialog components expect
// (status: 'Active'/'Inactive'), same pattern as Product/Brand's toViewRow.
function toViewRow(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    group: row.group || '',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    country: row.country || '',
    remarks: row.remarks || '',
    city: row.city || '',
    state: row.state || '',
    gstNo: row.gstNo || '',
    paymentTerms: row.paymentTerms || '',
    status: row.status === 'ACTIVE' ? 'Active' : 'Inactive',
    // Amount owed to this supplier. No payables ledger exists in the backend
    // yet, so this is 0 until the API starts returning `totalPayable`.
    totalPayable: Number(row.totalPayable) || 0,
  };
}

/**
 * Supplier — the Supplier master's list screen, reached from the Masters
 * page's "Supplier" card. Wired to the real Supplier API (see
 * api/supplierApi.js): list/search/status run server-side; Group/City/State/
 * GST-registered filters and the stat tiles are computed client-side over
 * whatever rows the current search/status filter returned — no backend
 * aggregation endpoint exists yet. Import / Export / Download Template work
 * on Excel files (see supplierExcel.js); export covers the rows currently shown.
 */
export default function SupplierPage() {
  const dispatch = useAppDispatch();
  const [searchInput, setSearchInput] = useState('');
  const [group, setGroup] = useState('All');
  const [status, setStatus] = useState('All');
  const [city, setCity] = useState('All');
  const [state, setState] = useState('All');
  const [gstRegistered, setGstRegistered] = useState('All');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formDialog, setFormDialog] = useState({ open: false, mode: 'add', row: null });
  const [viewRow, setViewRow] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importSuppliers] = useImportSuppliersMutation();

  const queryParams = {
    search: appliedSearch || undefined,
    status: status !== 'All' ? status.toUpperCase() : undefined,
  };
  const { data: supplierRows = [], isLoading, isError } = useGetSuppliersQuery(queryParams);
  const [deleteSupplier] = useDeleteSupplierMutation();


  const handleNewSupplier = () => setFormDialog({ open: true, mode: 'add', row: null });
  const handleImport = () => setImportOpen(true);
  const handleExport = () => {
    if (!filteredRows.length) {
      dispatch(showToast('There are no suppliers to export', 'info'));
      return;
    }
    exportSuppliers(filteredRows);
  };
  const handleSearch = () => setAppliedSearch(searchInput.trim().toLowerCase());
  const handleReset = () => {
    setSearchInput('');
    setGroup('All');
    setStatus('All');
    setCity('All');
    setState('All');
    setGstRegistered('All');
    setAppliedSearch('');
  };
  const handleOpenSupplier = (row) => setViewRow(row);
  const handleEditRow = (row) => setFormDialog({ open: true, mode: 'edit', row });
  const handleDeleteRow = async (row) => {
    if (!window.confirm(`Delete supplier "${row.name}"? This cannot be undone.`)) return;
    try {
      await deleteSupplier(row.id).unwrap();
      dispatch(showToast(`${row.name} deleted`, 'success'));
    } catch (err) {
      dispatch(showToast(err?.data?.message || 'Failed to delete supplier', 'error'));
    }
  };
  const closeFormDialog = () => setFormDialog((prev) => ({ ...prev, open: false }));

  const viewRows = useMemo(() => supplierRows.map(toViewRow), [supplierRows]);

  // Group/City/State/GST-registered are filtered client-side (the backend
  // doesn't index on them yet); search and status are already applied
  // server-side via the query above.
  const filteredRows = useMemo(() => viewRows.filter((row) => {
    if (group !== 'All' && row.group !== group) return false;
    if (city !== 'All' && row.city !== city) return false;
    if (state !== 'All' && row.state !== state) return false;
    if (gstRegistered !== 'All') {
      const hasGst = Boolean(row.gstNo);
      if (gstRegistered === 'Yes' && !hasGst) return false;
      if (gstRegistered === 'No' && hasGst) return false;
    }
    return true;
  }), [viewRows, group, city, state, gstRegistered]);

  const isFiltered = Boolean(appliedSearch) || group !== 'All' || status !== 'All' || city !== 'All' || state !== 'All' || gstRegistered !== 'All';

  const stats = useMemo(() => ({
    totalSuppliers: viewRows.length,
    activeSuppliers: viewRows.filter((r) => r.status === 'Active').length,
    inactiveSuppliers: viewRows.filter((r) => r.status === 'Inactive').length,
    gstRegistered: viewRows.filter((r) => Boolean(r.gstNo)).length,
    totalPayable: viewRows.reduce((sum, r) => sum + r.totalPayable, 0),
  }), [viewRows]);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Supplier</Typography>
          <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />} sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 12.5 } }}>
            <MuiLink component={RouterLink} to="/home" underline="hover" color="text.secondary">Home</MuiLink>
            <MuiLink component={RouterLink} to="/masters" underline="hover" color="text.secondary">Masters</MuiLink>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Supplier</Typography>
          </Breadcrumbs>
        </Box>
      </Stack>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', lg: 'center' }, justifyContent: 'flex-end' }}>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', justifyContent: { xs: 'flex-start', lg: 'flex-end' } }}>
          <Button variant="contained" color="primary" startIcon={<AddIcon fontSize="small" />} onClick={handleNewSupplier}>
            New Supplier
          </Button>
          <Button variant="outlined" color="primary" startIcon={<MoveToInboxOutlinedIcon fontSize="small" />} onClick={handleImport}>
            Import
          </Button>
          <Button variant="outlined" color="primary" startIcon={<FileUploadOutlinedIcon fontSize="small" />} onClick={handleExport}>
            Export
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 2.5 } }}>
        <Grid container spacing={1.5} sx={{ alignItems: 'flex-end' }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField
              label="Search Supplier"
              placeholder="Search by name, code or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              fullWidth
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <TextField select label="Supplier Group" value={group} onChange={(e) => setGroup(e.target.value)} fullWidth>
              <MenuItem value="All">All</MenuItem>
              {SUPPLIER_GROUP_OPTIONS.map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 1.5 }}>
            <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} fullWidth>
              <MenuItem value="All">All</MenuItem>
              <MenuItem value="Active">Active</MenuItem>
              <MenuItem value="Inactive">Inactive</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 1.5 }}>
            <TextField select label="City" value={city} onChange={(e) => setCity(e.target.value)} fullWidth>
              <MenuItem value="All">All</MenuItem>
              {CITY_OPTIONS.map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 1.5 }}>
            <TextField select label="State" value={state} onChange={(e) => setState(e.target.value)} fullWidth>
              <MenuItem value="All">All</MenuItem>
              {STATE_OPTIONS.map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 1.5 }}>
            <TextField select label="GST Registered" value={gstRegistered} onChange={(e) => setGstRegistered(e.target.value)} fullWidth>
              <MenuItem value="All">All</MenuItem>
              <MenuItem value="Yes">Yes</MenuItem>
              <MenuItem value="No">No</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, sm: 6, md: 1.4 }}>
            <Button variant="contained" color="primary" startIcon={<SearchIcon fontSize="small" />} onClick={handleSearch} fullWidth>
              Search
            </Button>
          </Grid>
          <Grid size={{ xs: 6, sm: 6, md: 1 }}>
            <Button variant="outlined" color="inherit" startIcon={<CloseIcon fontSize="small" />} onClick={handleReset} fullWidth>
              Reset
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 2.5 } }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Supplier List</Typography>
        {isError ? (
          <Typography variant="body2" sx={{ color: 'error.main', textAlign: 'center', py: 3 }}>
            Failed to load suppliers. Please try again.
          </Typography>
        ) : (
          <SupplierTable rows={filteredRows} loading={isLoading} onOpenSupplier={handleOpenSupplier} onEditRow={handleEditRow} onDeleteRow={handleDeleteRow} />
        )}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Showing {filteredRows.length ? 1 : 0} to {filteredRows.length} of {formatNumber(filteredRows.length)} records
          </Typography>
          <Pagination
            count={1}
            page={page}
            onChange={(_e, value) => setPage(value)}
            color="primary"
            shape="rounded"
          />
        </Stack>
      </Paper>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard icon={PeopleAltOutlinedIcon} iconColor="#7C3AED" iconShape="circle" label="Total Suppliers" value={formatNumber(stats.totalSuppliers)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard icon={FactCheckOutlinedIcon} iconColor="success" iconShape="circle" label="Active Suppliers" value={formatNumber(stats.activeSuppliers)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard icon={CloseIcon} iconColor="error" iconShape="circle" label="Inactive Suppliers" value={formatNumber(stats.inactiveSuppliers)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard icon={StorefrontIcon} iconColor="#2563EB" iconShape="circle" label="GST Registered" value={formatNumber(stats.gstRegistered)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard icon={AccountBalanceWalletOutlinedIcon} iconColor="warning" iconShape="circle" label="Total Payable" value={formatCurrency(stats.totalPayable, { decimals: true })} />
        </Grid>
      </Grid>

      <ExcelImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Suppliers"
        unitLabel="suppliers"
        description="Upload an .xlsx, .xls or .csv file (use Download Template for the exact columns). Supplier Name is required. A row whose Supplier Code, GST No. or name matches an existing supplier updates it; other rows create new suppliers."
        onDownloadTemplate={downloadSupplierTemplate}
        parseRows={parseSupplierRows}
        sendChunk={(rows) => importSuppliers({ rows }).unwrap()}
        chunkSize={200}
      />
      <SupplierFormDialog open={formDialog.open} mode={formDialog.mode} initialValues={formDialog.row} onClose={closeFormDialog} />
      <SupplierViewDialog
        open={Boolean(viewRow)}
        row={viewRow}
        onClose={() => setViewRow(null)}
        onEdit={() => {
          const row = viewRow;
          setViewRow(null);
          setFormDialog({ open: true, mode: 'edit', row });
        }}
      />
    </Stack>
  );
}
