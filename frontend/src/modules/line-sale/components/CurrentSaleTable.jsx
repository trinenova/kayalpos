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
import { stepFor, minQtyFor, round3 } from '../uomRules';

// Sentinel row appended after the last real line — it is the "new item" row.
const BLANK_KEY = '__new__';
const BLANK_ROW = { code: BLANK_KEY, key: BLANK_KEY, blank: true };

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
        if (next !== '' && next !== '.') onPriceChange?.(row.key, Number(next));
      }}
      slotProps={{ htmlInput: { inputMode: 'decimal', 'aria-label': `Price for ${row.name || row.code}`, style: { padding: '6px 8px', textAlign: 'right', fontSize: 14 } } }}
      sx={{ width: 96 }}
    />
  );
}

const fmtQty = (n) => String(round3(n));

// Editable quantity cell. Decimals are allowed (0.25 Kg) — up to 3
// places — for every UOM. Like PriceCell it keeps
// the typed text locally so partial input ("0.", ".5") works, pushes valid
// numbers to the cart as you type, and snaps back to the cart value on blur
// (an empty / zero entry reverts to the last valid quantity).
function QtyCell({ row, onQtyChange }) {
  const unit = { uom: row.enteredUom };
  const step = stepFor(unit);
  const min = minQtyFor(unit);
  const [text, setText] = useState(fmtQty(row.enteredQty));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(fmtQty(row.enteredQty));
  }, [row.enteredQty, focused]);

  const commit = (n) => onQtyChange?.(row.key, n);
  return (
    <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center' }}>
      <IconButton
        size="small"
        data-no-enter
        aria-label="Decrease quantity"
        onClick={() => commit(Math.max(min, round3(row.enteredQty - step)))}
        disabled={row.enteredQty - step < min}
      >
        <RemoveCircleOutlineIcon fontSize="small" />
      </IconButton>
      <TextField
        size="small"
        variant="outlined"
        value={text}
        onFocus={(e) => { setFocused(true); e.target.select(); }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const next = e.target.value.replace(/[^0-9.]/g, '');
          if ((next.match(/\./g) || []).length > 1) return;
          if (/\.\d{4,}$/.test(next)) return; // max 3 decimal places
          setText(next);
          const n = Number(next);
          if (next !== '' && next !== '.' && n >= min) commit(n);
        }}
        slotProps={{
          htmlInput: {
            inputMode: 'decimal',
            'aria-label': `Quantity for ${row.name || row.code}`,
            style: { padding: '6px 4px', textAlign: 'center', fontSize: 14, fontWeight: 700 },
          },
        }}
        sx={{ width: 76 }}
      />
      <IconButton
        size="small"
        data-no-enter
        aria-label="Increase quantity"
        onClick={() => commit(round3(row.enteredQty + step))}
      >
        <AddCircleOutlineIcon fontSize="small" sx={{ color: 'primary.main' }} />
      </IconButton>
    </Stack>
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
  lines, onQtyChange, onUomChange, onPriceChange, onRemove, products, onAddItem, onReplaceItem, onNotify,
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
  // `barcode` is the barcode the item was scanned / picked with (if any): a
  // barcode with its own price bills the line at that price and UOM.
  const selectForRow = (row) => (code, barcode = null) => (
    row.blank ? onAddItem(code, barcode) : onReplaceItem(row.key, code, barcode)
  );

  const columns = [
    { key: 'index', label: '#', width: '4%', render: (_row, i) => i + 1 },
    // Barcode is the first field of every row, so a scanner can feed the
    // table straight away; Tab then moves on to Item Name.
    {
      key: 'barcode',
      label: 'Barcode',
      width: '14%',
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
      key: 'uom',
      label: 'UOM',
      width: '11%',
      render: (row) => {
        if (row.blank) return null;
        const options = row.uomOptions?.length ? row.uomOptions : [row.enteredUom];
        if (options.length < 2 || !onUomChange) {
          return <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.enteredUom}</Typography>;
        }
        return (
          <TextField
            select
            size="small"
            value={row.enteredUom}
            onChange={(e) => onUomChange(row.key, e.target.value)}
            slotProps={{ htmlInput: { 'aria-label': `UOM for ${row.name || row.code}` } }}
            sx={{ minWidth: 84, '& .MuiSelect-select': { py: '6px', fontSize: 14, fontWeight: 600 } }}
          >
            {options.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
          </TextField>
        );
      },
    },
    {
      key: 'price',
      label: 'Price',
      width: '14%',
      render: (row) => (row.blank ? null : (
        // Price is per the item's base unit (per Kg, per Nos) whatever UOM the
        // quantity is entered in — shown under the field so it is clear
        // what unit the rate applies to.
        <Stack spacing={0}>
          {onPriceChange
            ? <PriceCell row={row} onPriceChange={onPriceChange} />
            : <Typography variant="body2">{formatCurrency(row.price, { decimals: true })}</Typography>}
          <Typography variant="caption" color="text.secondary">per {row.uom}</Typography>
        </Stack>
      )),
    },
    {
      key: 'qty',
      label: 'Qty / Weight',
      width: '17%',
      render: (row) => (row.blank ? null : <QtyCell row={row} onQtyChange={onQtyChange} />),
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      width: '13%',
      render: (row) => (row.blank ? null : (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {formatCurrency(row.qty * row.price, { decimals: true })}
          </Typography>
          <IconButton size="small" color="error" data-no-enter onClick={() => onRemove(row.key)}>
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
          getRowKey={(r) => r.key}
          fitContainer
        />
      </Box>
      <RecentSalesDialog open={recentOpen} onClose={() => setRecentOpen(false)} />
    </Paper>
  );
}
