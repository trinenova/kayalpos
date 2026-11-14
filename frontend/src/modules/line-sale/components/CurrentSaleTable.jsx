import { useEffect, useMemo, useState } from 'react';
import {
  Paper, Stack, Box, Typography, Chip, IconButton, TextField, MenuItem, Button,
} from '@mui/material';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutlineOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';

import DataTable from '../../../components/common/DataTable';
import { formatCurrency } from '../../../utils/format';
import RecentSalesDialog from './RecentSalesDialog';
import ItemSearchCell, { BarcodeCell, useItemSearchIndex } from './ItemSearchCell';

// Sentinel row appended after the last real line — it is the "new item" row.
const BLANK_KEY = '__new__';
const BLANK_ROW = { code: BLANK_KEY, blank: true };

// Editable unit-price cell. Keeps what is being typed locally so partial input
// ("1", "12.", ...) works, pushes valid numbers to the cart as you type, and
// snaps back to the formatted cart price when you leave the field.
function PriceCell({ row, onPriceChange }) {
  const [text, setText] = useState(String(row.price ?? ''));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(String(Math.round((Number(row.price) || 0) * 100) / 100));
  }, [row.price, focused]);
  return (
    <TextField
      size="small"
      variant="outlined"
      value={text}
      onFocus={(e) => { setFocused(true); e.target.select(); }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const next = e.target.value.replace(/[^0-9.]/g, '');
        if ((next.match(/\./g) || []).length > 1) return;
        setText(next);
        if (next !== '' && next !== '.') onPriceChange?.(row.code, Number(next));
      }}
      slotProps={{ htmlInput: { inputMode: 'decimal', 'aria-label': `Price for ${row.name || row.code}`, style: { padding: '6px 8px', textAlign: 'right', fontSize: 14 } } }}
      sx={{ width: 96 }}
    />
  );
}

/**
 * "Current Sale" table — an entry grid. Every row has its own item
 * search/select cell (Product master + Barcode & Label, tagged by source):
 *
 *   - the last row is always a blank entry row; picking an item there fills
 *     it and the table automatically opens the next blank row below, so
 *     items are entered one row at a time without any separate search box;
 *   - an already-filled row can be searched again to swap that line's item.
 *
 * Price / QTY (+/- stepper) / Total sit in the same row as the item.
 */
export default function CurrentSaleTable({
  lines, onQtyChange, onPriceChange, onRemove, products, onAddItem, onReplaceItem, onNotify,
  counters = [], counter = '', onCounterChange,
}) {
  const index = useItemSearchIndex(products);
  const [recentOpen, setRecentOpen] = useState(false);

  const rows = useMemo(() => [...lines, BLANK_ROW], [lines]);
  // Every Item Name box takes the width of the longest name on the bill.
  const longestName = useMemo(
    () => lines.reduce((m, l) => Math.max(m, String(l.name || '').length), 0),
    [lines],
  );

  // Picking/scanning in either the Item or the Barcode cell: the blank row
  // adds a new line (and the table opens the next blank row), a filled row
  // swaps that line's item.
  const selectForRow = (row) => (code) => (
    row.blank ? onAddItem(code) : onReplaceItem(row.code, code)
  );

  const columns = [
    { key: 'index', label: '#', width: '5%', render: (_row, i) => i + 1 },
    // Barcode is the first field of every row, so a scanner can feed the
    // table straight away; Tab then moves on to Item Name.
    {
      key: 'barcode',
      label: 'Barcode',
      width: '17%',
      render: (row) => (
        <BarcodeCell
          index={index}
          line={row.blank ? null : row}
          onNotify={onNotify}
          autoFocus={row.blank && lines.length === 0}
          onSelect={selectForRow(row)}
        />
      ),
    },
    {
      key: 'item',
      label: 'Item Name',
      width: 'auto',
      render: (row) => (
        <ItemSearchCell
          fit
          minChars={longestName}
          index={index}
          line={row.blank ? null : row}
          onNotify={onNotify}
          onSelect={selectForRow(row)}
        />
      ),
    },
    {
      key: 'price',
      label: 'Price',
      width: '15%',
      render: (row) => (row.blank ? null : (
        onPriceChange
          ? <PriceCell row={row} onPriceChange={onPriceChange} />
          : <Typography variant="body2">{formatCurrency(row.price, { decimals: true })}</Typography>
      )),
    },
    {
      key: 'qty',
      label: 'QTY',
      width: '19%',
      render: (row) => (row.blank ? null : (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <IconButton size="small" data-no-enter onClick={() => onQtyChange(row.code, row.qty - 1)} disabled={row.qty <= 1}>
            <RemoveCircleOutlineIcon fontSize="small" />
          </IconButton>
          <Typography variant="body2" sx={{ fontWeight: 700, width: 22, textAlign: 'center' }}>
            {row.qty}
          </Typography>
          <IconButton size="small" data-no-enter onClick={() => onQtyChange(row.code, row.qty + 1)}>
            <AddCircleOutlineIcon fontSize="small" sx={{ color: 'primary.main' }} />
          </IconButton>
        </Stack>
      )),
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      width: '14%',
      render: (row) => (row.blank ? null : (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {formatCurrency(row.qty * row.price, { decimals: true })}
          </Typography>
          <IconButton size="small" color="error" data-no-enter onClick={() => onRemove(row.code)}>
            <DeleteOutlineOutlinedIcon fontSize="small" />
          </IconButton>
        </Stack>
      )),
    },
  ];

  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 2.5, pt: 2, pb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Current Sale</Typography>
        <Chip label={`${lines.length} ${lines.length === 1 ? 'Item' : 'Items'}`} size="small" sx={{ fontWeight: 700 }} />
        <Button
          variant="outlined"
          size="small"
          startIcon={<HistoryOutlinedIcon fontSize="small" />}
          onClick={() => setRecentOpen(true)}
          sx={{ ml: 'auto !important', whiteSpace: 'nowrap', fontWeight: 700 }}
        >
          Recent Sales
        </Button>
        {onCounterChange && (
          // Counter = Item Group: limits the item / barcode search to that
          // counter's products ("All Counters" = no limit).
          <TextField
            select
            size="small"
            label="Counter"
            value={counter}
            onChange={(e) => onCounterChange(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">All Counters</MenuItem>
            {counters.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
          </TextField>
        )}
      </Stack>

      <Box sx={{ px: 2.5, pb: 2.5, flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.code}
          fitContainer
        />
      </Box>
      <RecentSalesDialog open={recentOpen} onClose={() => setRecentOpen(false)} />
    </Paper>
  );
}
