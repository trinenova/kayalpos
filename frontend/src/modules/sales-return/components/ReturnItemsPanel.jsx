import { useEffect, useState } from 'react';
import {
  Box, Paper, Stack, Tabs, Tab, TextField, InputAdornment, IconButton, Typography, Button, Avatar, MenuItem, Tooltip,
} from '@mui/material';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';
import FilterListOutlinedIcon from '@mui/icons-material/FilterListOutlined';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import DataTable from '../../../components/common/DataTable';
import { formatCurrency } from '../../../utils/format';
import { RETURN_TYPES } from '../salesReturnConstants';

const PAGE_SIZE = 6;

// Purely decorative avatar coloring (no business data attached to it) —
// cycles a fixed palette by row position so items are visually distinct
// without inventing anything about the item itself.
const AVATAR_COLORS = ['#F26B21', '#22A06B', '#F5A623', '#2563EB', '#D97706', '#E5484D', '#8B5CF6'];

/**
 * Left-hand "item picking" panel: a Return/Exchange select up top decides
 * what the rest of the card is for, then three tabs:
 *  - "Original Invoice Items" — always available: lines still eligible to
 *    come back from the loaded invoice (see SalesReturnPage's
 *    `originalInvoice.items`, from GET /api/sales-returns/lookup/:billNo).
 *    Adding one here feeds the Return cart, in both Return and Exchange
 *    mode — an exchange still needs something handed back.
 *  - "Scan / Search Item" — only meaningful in Exchange mode: a live search
 *    of the product catalog (GET /api/masters/product?search=) for the NEW
 *    goods the customer is taking. Adding one here feeds the Exchange
 *    cart. In Return mode there is nothing to buy, so this tab is disabled
 *    rather than left silently inert.
 *  - "Recent Items" — not wired to anything real yet (no "recently
 *    exchanged" signal exists to show honestly), so it stays disabled with
 *    a "Coming soon" tooltip instead of pretending to work.
 * Only items with `returnableQty > 0` can still be added from the original
 * invoice — everything else has already been fully returned across prior
 * returns against this same invoice. Rows there are keyed by `saleLineId`
 * (the real original SaleLine), not item code, since that's what the
 * backend actually tracks returns against; product-search rows are keyed
 * by the real Product id.
 */
export default function ReturnItemsPanel({
  returnType, onReturnTypeChange,
  items, onAddItem,
  productQuery, onProductQueryChange, productResults = [], isSearchingProducts, onAddExchangeItem,
}) {
  const isExchange = returnType === 'exchange';
  const [tab, setTab] = useState('original');
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // A plain Return has nothing to scan/search for (no new goods are
  // changing hands), so the tab is forced back to the one that matters the
  // moment the mode switches away from Exchange — never leaves the panel
  // stuck showing a disabled tab's stale content.
  useEffect(() => {
    if (!isExchange && tab !== 'original') setTab('original');
  }, [isExchange, tab]);

  const filtered = items.filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q);
  });
  const visibleItems = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // Explicit widths (summing to 100%) so the table always fits the panel —
  // see DataTable's `fitContainer` doc comment.
  const originalColumns = [
    { key: 'index', label: '#', width: '5%', render: (_row, i) => i + 1 },
    {
      key: 'item',
      label: 'Item Details',
      width: '35%',
      wrap: true,
      render: (row, i) => (
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'flex-start', minWidth: 0 }}>
          <Avatar variant="rounded" sx={{ bgcolor: AVATAR_COLORS[i % AVATAR_COLORS.length], width: 34, height: 34, fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
            {row.name.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.25 }}>{row.name}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{row.code}</Typography>
          </Box>
        </Stack>
      ),
    },
    {
      key: 'qty',
      label: 'Sold / Returnable',
      width: '30%',
      wrap: true,
      render: (row) => (
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            Sold: {row.saleQty} {row.uom}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, color: row.returnableQty > 0 ? 'success.main' : 'text.disabled' }}>
            Returnable: {row.returnableQty} {row.uom}
          </Typography>
        </Box>
      ),
    },
    {
      // The amount this line was actually billed for on the original invoice
      // (same figure as the invoice's Amount column) — never the product's MRP.
      key: 'amount',
      label: 'Amount',
      width: '18%',
      wrap: true,
      render: (row) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatCurrency(row.amount, { decimals: true })}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            @ {formatCurrency(row.rate, { decimals: true })}
          </Typography>
        </Box>
      ),
    },
    {
      key: 'add',
      label: '',
      align: 'right',
      width: '12%',
      render: (row) => (
        <IconButton
          size="small"
          disabled={row.returnableQty <= 0}
          onClick={() => onAddItem(row.saleLineId)}
          sx={{
            bgcolor: 'rgba(242,107,33,0.1)',
            color: 'primary.main',
            '&:hover': { bgcolor: 'rgba(242,107,33,0.2)' },
          }}
        >
          <AddIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];

  const productColumns = [
    { key: 'index', label: '#', width: '5%', render: (_row, i) => i + 1 },
    {
      key: 'item',
      label: 'Item Details',
      width: '38%',
      wrap: true,
      render: (row, i) => (
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'flex-start', minWidth: 0 }}>
          <Avatar variant="rounded" sx={{ bgcolor: AVATAR_COLORS[i % AVATAR_COLORS.length], width: 34, height: 34, fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
            {row.name.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.25 }}>{row.name}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{row.code}</Typography>
          </Box>
        </Stack>
      ),
    },
    {
      key: 'stock',
      label: 'In Stock',
      width: '22%',
      wrap: true,
      render: (row) => (
        <Typography variant="body2" sx={{ fontWeight: 700, color: row.availableQty > 0 ? 'text.primary' : 'error.main' }}>
          {row.availableQty} {row.uom}
        </Typography>
      ),
    },
    {
      key: 'price',
      label: 'Price',
      width: '20%',
      wrap: true,
      render: (row) => <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatCurrency(row.salePrice, { decimals: true })}</Typography>,
    },
    {
      key: 'add',
      label: '',
      align: 'right',
      width: '15%',
      render: (row) => (
        <IconButton
          size="small"
          onClick={() => onAddExchangeItem(row)}
          sx={{
            bgcolor: 'rgba(34,160,107,0.1)',
            color: 'success.main',
            '&:hover': { bgcolor: 'rgba(34,160,107,0.2)' },
          }}
        >
          <AddIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];

  const scanTabDisabled = !isExchange;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 2, pt: 1.5 }}>
        <TextField
          select
          size="small"
          label="Return / Exchange"
          value={returnType}
          onChange={(e) => onReturnTypeChange(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          {RETURN_TYPES.map((t) => (
            <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
          ))}
        </TextField>
      </Box>

      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          px: 2, pt: 1,
          minHeight: 40,
          borderBottom: '1px solid',
          borderColor: 'divider',
          '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap' },
        }}
      >
        <Tab value="original" label="Original Invoice Items" />
        {/* MUI's Tabs clones its selection/onChange wiring onto each DIRECT
            child — wrapping an Tooltip+span around a Tab (the documented way
            to show a tooltip on a *disabled* tab) breaks that wiring, since
            the wiring lands on the Tooltip instead of the Tab underneath.
            So the wrapper only goes on while the tab really is disabled;
            once Exchange mode enables it, it renders as a bare, directly-
            clickable Tab like the other two. */}
        {scanTabDisabled ? (
          <Tooltip title="Switch to Exchange to pick a replacement item">
            <span>
              <Tab value="scan" label="Scan / Search Item" disabled />
            </span>
          </Tooltip>
        ) : (
          <Tab value="scan" label="Scan / Search Item" />
        )}
        <Tooltip title="Coming soon">
          <span>
            <Tab value="recent" label="Recent Items" disabled />
          </span>
        </Tooltip>
      </Tabs>

      {tab === 'original' ? (
        <>
          <Box sx={{ p: 2, pb: 1 }}>
            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search item by name or code…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setVisibleCount(PAGE_SIZE); }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <IconButton size="small" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                <FilterListOutlinedIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Box>

          <Box sx={{ px: 2, pb: 2, flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
              <DataTable
                columns={originalColumns}
                rows={visibleItems}
                getRowKey={(r) => r.saleLineId}
                emptyMessage={items.length === 0 ? 'Find an original invoice to see its items' : 'No items match your search'}
                fitContainer
              />
            </Box>

            {hasMore && (
              <Box sx={{ textAlign: 'center', pt: 1.5 }}>
                <Button
                  variant="text"
                  endIcon={<ExpandMoreIcon />}
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  sx={{ fontWeight: 700 }}
                >
                  Load More Items
                </Button>
              </Box>
            )}
          </Box>
        </>
      ) : (
        <>
          <Box sx={{ p: 2, pb: 1 }}>
            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search the product catalog by name, code or barcode…"
                value={productQuery}
                onChange={(e) => onProductQueryChange(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small">
                          <QrCodeScannerOutlinedIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Stack>
          </Box>

          <Box sx={{ px: 2, pb: 2, flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
              <DataTable
                columns={productColumns}
                rows={productResults}
                getRowKey={(r) => r.id}
                emptyMessage={
                  isSearchingProducts
                    ? 'Searching…'
                    : productQuery.trim()
                      ? 'No products match your search'
                      : 'Type a product name, code or barcode to pick the item the customer is taking'
                }
                fitContainer
              />
            </Box>
          </Box>
        </>
      )}
    </Paper>
  );
}
