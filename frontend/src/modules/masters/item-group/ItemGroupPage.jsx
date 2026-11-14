import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Stack, Box, Typography, Breadcrumbs, Link as MuiLink, Grid, Paper, Button,
  TextField, MenuItem, InputAdornment,
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import ViewInArOutlinedIcon from '@mui/icons-material/ViewInArOutlined';
import HighlightOffOutlinedIcon from '@mui/icons-material/HighlightOffOutlined';

import { useAppDispatch } from '../../../app/hooks';
import { showToast } from '../../../features/ui/uiSlice';
import StatCard from '../../../components/common/StatCard';
import { formatNumber } from '../../../utils/format';
import { useGetItemGroupsQuery, useDeleteItemGroupMutation } from '../../../api/itemGroupApi';
import { useGetProductsQuery } from '../../../api/productApi';

import ItemGroupTable from './components/ItemGroupTable';
import ItemGroupFormDialog from './components/ItemGroupFormDialog';
import ItemGroupViewDialog from './components/ItemGroupViewDialog';

function toViewRow(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || '',
    status: row.status === 'ACTIVE' ? 'Active' : 'Inactive',
    createdAt: row.createdAt,
  };
}

function FilterField({ label, children }) {
  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>{label}</Typography>
      {children}
    </Box>
  );
}

/**
 * Item Group — the Masters > Item Group master (`/masters/item-group`). A
 * single page like Brand: list + search/status filter, with Add/Edit/View as
 * dialogs. The Product form's "Item Group" dropdown is fed from this list.
 */
export default function ItemGroupPage() {
  const dispatch = useAppDispatch();

  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('All');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [formDialog, setFormDialog] = useState({ open: false, mode: 'add', row: null });
  const [viewRow, setViewRow] = useState(null);

  const { data: groupRows = [], isLoading, isError } = useGetItemGroupsQuery({
    search: appliedSearch || undefined,
    status: status !== 'All' ? status.toUpperCase() : undefined,
  });
  const [deleteItemGroup] = useDeleteItemGroupMutation();
  // Product.group stores the group's name, so "items" per group is the number
  // of products whose group matches.
  const { data: productRows = [] } = useGetProductsQuery();

  const handleSearch = () => setAppliedSearch(searchInput.trim());
  const handleReset = () => {
    setSearchInput('');
    setStatus('All');
    setAppliedSearch('');
  };
  const closeFormDialog = () => setFormDialog((prev) => ({ ...prev, open: false }));

  const viewRows = useMemo(() => groupRows.map(toViewRow), [groupRows]);

  const itemCounts = useMemo(() => {
    const counts = {};
    productRows.forEach((p) => {
      if (!p.group) return;
      const key = String(p.group).trim().toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [productRows]);

  const handleDeleteRow = async (row) => {
    const inUse = itemCounts[row.name.trim().toLowerCase()] || 0;
    const warning = inUse > 0 ? ` ${inUse} product(s) still use this group name.` : '';
    if (!window.confirm(`Delete item group "${row.name}"?${warning} This cannot be undone.`)) return;
    try {
      await deleteItemGroup(row.id).unwrap();
      dispatch(showToast(`${row.name} deleted`, 'success'));
    } catch (err) {
      dispatch(showToast(err?.data?.message || 'Failed to delete item group', 'error'));
    }
  };

  const stats = useMemo(() => ({
    total: viewRows.length,
    active: viewRows.filter((r) => r.status === 'Active').length,
    inactive: viewRows.filter((r) => r.status === 'Inactive').length,
    items: viewRows.reduce((sum, r) => sum + (itemCounts[r.name.trim().toLowerCase()] || 0), 0),
  }), [viewRows, itemCounts]);

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Item Group</Typography>
        <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />} sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 12.5 } }}>
          <MuiLink component={RouterLink} to="/home" underline="hover" color="text.secondary">Home</MuiLink>
          <MuiLink component={RouterLink} to="/masters" underline="hover" color="text.secondary">Masters</MuiLink>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Item Group</Typography>
        </Breadcrumbs>
      </Box>

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <Button variant="contained" color="primary" startIcon={<AddIcon fontSize="small" />} onClick={() => setFormDialog({ open: true, mode: 'add', row: null })}>
          New Item Group
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 2.5 } }}>
        <Grid container spacing={1.5} sx={{ alignItems: 'flex-end' }}>
          <Grid size={{ xs: 12, sm: 6, md: 5 }}>
            <FilterField label="Search Item Group">
              <TextField
                placeholder="Search by group name or code..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                fullWidth
                slotProps={{ input: { endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> } }}
              />
            </FilterField>
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 2 }}>
            <FilterField label="Status">
              <TextField select value={status} onChange={(e) => setStatus(e.target.value)} fullWidth>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Inactive">Inactive</MenuItem>
              </TextField>
            </FilterField>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }} sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" color="primary" startIcon={<SearchIcon fontSize="small" />} onClick={handleSearch} fullWidth>
              Search
            </Button>
            <Button variant="outlined" color="primary" startIcon={<RefreshOutlinedIcon fontSize="small" />} onClick={handleReset} fullWidth>
              Reset
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 2.5 } }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Item Group List</Typography>
        {isError ? (
          <Typography variant="body2" sx={{ color: 'error.main', textAlign: 'center', py: 3 }}>
            Failed to load item groups. Please try again.
          </Typography>
        ) : (
          <Box sx={{ opacity: isLoading ? 0.6 : 1, transition: 'opacity 0.15s ease' }}>
            <ItemGroupTable
              rows={viewRows}
              itemCounts={itemCounts}
              onOpen={setViewRow}
              onEditRow={(row) => setFormDialog({ open: true, mode: 'edit', row })}
              onDeleteRow={handleDeleteRow}
            />
          </Box>
        )}
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2 }}>
          Showing {viewRows.length} of {viewRows.length} records
        </Typography>
      </Paper>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard icon={CategoryOutlinedIcon} iconColor="#2563EB" iconShape="circle" label="Total Item Groups" value={formatNumber(stats.total)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard icon={CheckCircleOutlineIcon} iconColor="success" iconShape="circle" label="Active Item Groups" value={formatNumber(stats.active)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard icon={HighlightOffOutlinedIcon} iconColor="error" iconShape="circle" label="Inactive Item Groups" value={formatNumber(stats.inactive)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard icon={ViewInArOutlinedIcon} iconColor="#F26B21" iconShape="circle" label="Total Items In Groups" value={formatNumber(stats.items)} />
        </Grid>
      </Grid>

      <ItemGroupFormDialog open={formDialog.open} mode={formDialog.mode} initialValues={formDialog.row} onClose={closeFormDialog} />
      <ItemGroupViewDialog
        open={Boolean(viewRow)}
        row={viewRow}
        totalItems={viewRow ? (itemCounts[viewRow.name.trim().toLowerCase()] || 0) : 0}
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
