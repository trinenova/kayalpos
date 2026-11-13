import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Link as RouterLink } from 'react-router-dom';
import {
  Stack, Box, Typography, Breadcrumbs, Link as MuiLink, Paper, Button,
  TextField, InputAdornment, Table, TableHead, TableRow, TableCell, TableBody,
  CircularProgress, IconButton, Tooltip,
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SearchIcon from '@mui/icons-material/Search';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';

import { useAppDispatch } from '../../../app/hooks';
import { showToast } from '../../../features/ui/uiSlice';
import { formatNumber, formatCurrency } from '../../../utils/format';
import { useGetPriceGridQuery, useBulkUpdatePriceGridMutation } from '../../../api/sellingPriceApi';
import PriceHistoryDialog from './components/PriceHistoryDialog';

function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(value));
}

/**
 * Price List — repurposed from a "manage named Price List entities" screen
 * into a flat "every product, with its current price" grid matching the
 * reference design: one row per ACTIVE product (see
 * backend/src/modules/selling-price's listPriceGrid), with its previous/
 * current price and effective dates, an editable Remarks + "Update Price"
 * cell per row, and a single "Bulk Update" button that saves every row
 * whose price was actually changed in one request. The old named-Price-List
 * master (Masters > Price List's backend module/api) still exists — it's
 * just no longer what this particular page manages; Product's own "Price
 * List" field and the Selling Price master still reference it by name.
 */
export default function PriceListPage() {
  const dispatch = useAppDispatch();
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  // Per-product draft edits for the Remarks / "Update Price" cells — reset
  // from the server's rows whenever the grid reloads (see the effect below),
  // so a saved Bulk Update doesn't leave stale typed values behind.
  const [edits, setEdits] = useState({});
  const [historyRow, setHistoryRow] = useState(null);

  const { data: rows = [], isLoading, isError } = useGetPriceGridQuery({
    search: appliedSearch || undefined,
    pageSize: 500,
  });
  const [bulkUpdate, { isLoading: isSaving }] = useBulkUpdatePriceGridMutation();

  useEffect(() => {
    setEdits((prev) => {
      const next = {};
      rows.forEach((row) => {
        next[row.productId] = {
          price: prev[row.productId]?.price ?? String(row.currentPrice ?? ''),
          remarks: prev[row.productId]?.remarks ?? '',
        };
      });
      return next;
    });
  }, [rows]);

  const handleSearch = () => setAppliedSearch(searchInput.trim());
  const handlePriceChange = (productId, value) => {
    setEdits((prev) => ({ ...prev, [productId]: { ...prev[productId], price: value } }));
  };
  const handleRemarksChange = (productId, value) => {
    setEdits((prev) => ({ ...prev, [productId]: { ...prev[productId], remarks: value } }));
  };

  const handleExport = () => {
    const headers = ['Product Code', 'Product Name', 'Category', 'UOM', 'Pack Size', 'Previous Price', 'Current Price', 'Effective From', 'Effective To'];
    const data = rows.map((row) => [
      row.code, row.name, row.category || '', row.uom || '', row.packSize || '',
      row.previousPrice ?? '', row.currentPrice ?? '', formatDateTime(row.effectiveFrom), row.effectiveTo ? formatDateTime(row.effectiveTo) : 'Ongoing',
    ]);
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    sheet['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Price List');
    XLSX.writeFile(workbook, 'Price_List.xlsx');
  };

  const handleBulkUpdate = async () => {
    const updates = rows
      .map((row) => {
        const edit = edits[row.productId];
        const price = Number(edit?.price);
        if (!edit || edit.price === '' || Number.isNaN(price) || price < 0) return null;
        if (price === Number(row.currentPrice)) return null;
        return { productId: row.productId, price, remarks: edit.remarks?.trim() || undefined };
      })
      .filter(Boolean);

    if (!updates.length) {
      dispatch(showToast('No price changes to save', 'info'));
      return;
    }
    try {
      const result = await bulkUpdate({ updates }).unwrap();
      dispatch(showToast(`Updated price for ${result.updated} product(s)`, 'success'));
    } catch (err) {
      dispatch(showToast(err?.data?.message || 'Failed to update prices', 'error'));
    }
  };

  const changedCount = useMemo(() => rows.filter((row) => {
    const edit = edits[row.productId];
    const price = Number(edit?.price);
    return edit && edit.price !== '' && !Number.isNaN(price) && price !== Number(row.currentPrice);
  }).length, [rows, edits]);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Price List</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Every pack size across your catalog, with its current price</Typography>
          <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />} sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 12.5 }, mt: 0.5 }}>
            <MuiLink component={RouterLink} to="/home" underline="hover" color="text.secondary">Home</MuiLink>
            <MuiLink component={RouterLink} to="/masters" underline="hover" color="text.secondary">Masters</MuiLink>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Price List</Typography>
          </Breadcrumbs>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" color="primary" startIcon={<FileUploadOutlinedIcon fontSize="small" />} onClick={handleExport}>
            Export
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={isSaving ? <CircularProgress size={14} /> : <EditNoteOutlinedIcon fontSize="small" />}
            onClick={handleBulkUpdate}
            disabled={isSaving || !changedCount}
          >
            Bulk Update{changedCount ? ` (${changedCount})` : ''}
          </Button>
        </Stack>
      </Stack>

      <TextField
        placeholder="Search by product name, code, category or pack size..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
        onBlur={handleSearch}
        fullWidth
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
      />

      <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 1.5, sm: 2 } }}>
        {isError ? (
          <Typography variant="body2" sx={{ color: 'error.main', textAlign: 'center', py: 3 }}>
            Failed to load the price list. Please try again.
          </Typography>
        ) : (
          <Box sx={{ overflowX: 'auto', opacity: isLoading ? 0.6 : 1, transition: 'opacity 0.15s ease' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>UOM</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Pack Size</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Previous Price</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Current Price</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Effective From</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Effective To</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Remarks</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Update Price (₹)</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.productId} hover>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{row.code} · {row.name}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{row.category || '—'}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{row.uom || '—'}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{row.packSize || '—'}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>
                      {row.previousPrice != null ? formatCurrency(row.previousPrice, { decimals: true }) : '—'}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'warning.dark' }}>
                      {formatCurrency(row.currentPrice ?? 0, { decimals: true })}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>{formatDateTime(row.effectiveFrom)}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{row.effectiveTo ? formatDateTime(row.effectiveTo) : 'Ongoing'}</TableCell>
                    <TableCell sx={{ minWidth: 160 }}>
                      <TextField
                        size="small"
                        placeholder="Add remark"
                        value={edits[row.productId]?.remarks ?? ''}
                        onChange={(e) => handleRemarksChange(row.productId, e.target.value)}
                        fullWidth
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 110 }}>
                      <TextField
                        size="small"
                        type="number"
                        value={edits[row.productId]?.price ?? ''}
                        onChange={(e) => handlePriceChange(row.productId, e.target.value)}
                        slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                        fullWidth
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Price History">
                        <IconButton size="small" onClick={() => setHistoryRow(row)} aria-label={`Price history for ${row.name}`}>
                          <HistoryOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>
                      No products found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        )}

        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2 }}>
          Showing {formatNumber(rows.length)} record(s)
        </Typography>
      </Paper>

      <PriceHistoryDialog open={Boolean(historyRow)} product={historyRow} onClose={() => setHistoryRow(null)} />
    </Stack>
  );
}
