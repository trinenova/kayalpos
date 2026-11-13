import { useMemo, useRef, useState } from 'react';
import {
  Box, Autocomplete, TextField, InputAdornment, Typography, Chip,
} from '@mui/material';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';

import { useGetBarcodeLabelBatchesQuery } from '../../../api/barcodeLabelApi';
import { formatCurrency } from '../../../utils/format';

export const SOURCE_PRODUCT = 'Product master';
export const SOURCE_BARCODE = 'Barcode & Label';
const MAX_OPTIONS = 25;

const norm = (v) => String(v ?? '').trim().toLowerCase();

// Puts the cursor in the first input of the table row `el` sits in — the
// Barcode cell, which is the first field of every Line Sale row.
function focusFirstInputOfRow(el) {
  setTimeout(() => el?.closest('tr')?.querySelector('input')?.focus(), 0);
}

/**
 * Builds the two searchable lists ONCE per table (not once per row):
 *   - Product master entries (Masters > Product): matched by code / name.
 *   - Barcode & Label entries (/barcode-label): matched by barcode, item code
 *     or item name. The Product master has no barcode column, so a barcode
 *     printed from Barcode & Label is the only way a scanned code can map
 *     back to a product. Label rows whose item isn't an active product are
 *     dropped (nothing sellable), and the same item+barcode printed in many
 *     batches is de-duplicated.
 * Every entry carries `source` so the dropdown can tag where it came from.
 */
export function useItemSearchIndex(products) {
  const { data: batches = [], isLoading } = useGetBarcodeLabelBatchesQuery();

  return useMemo(() => {
    const productByCode = Object.fromEntries(products.map((p) => [p.code, p]));

    const productEntries = products.map((p) => ({
      source: SOURCE_PRODUCT, code: p.code, name: p.name, barcode: '', product: p,
    }));

    const seen = new Set();
    const labelEntries = [];
    batches.forEach((batch) => {
      (batch.items || []).forEach((item) => {
        const product = productByCode[item.itemCode];
        if (!product) return;
        const key = `${item.itemCode}|${item.barcode || ''}`;
        if (seen.has(key)) return;
        seen.add(key);
        labelEntries.push({
          source: SOURCE_BARCODE, code: product.code, name: product.name, barcode: item.barcode || '', product,
        });
      });
    });

    // First barcode on file per product code — shown in each row's Barcode cell.
    const barcodeByCode = {};
    labelEntries.forEach((e) => {
      if (e.barcode && !barcodeByCode[e.code]) barcodeByCode[e.code] = e.barcode;
    });

    return { productByCode, productEntries, labelEntries, barcodeByCode, isLoading };
  }, [products, batches, isLoading]);
}

/**
 * One item search/select cell. The Current Sale table renders one of these in
 * EVERY row: the trailing blank row is where a new item is entered (picking
 * one fills the row and the table automatically opens the next blank row),
 * and each filled row can be searched again to swap that line's item.
 *
 * Search = Product master + Barcode & Label together, grouped and tagged by
 * source. Enter (or a scanner's terminator key) tries exact product code →
 * exact barcode → exact label item code, then a name match only if it narrows
 * to a single product; ambiguous / unknown input raises `onNotify`.
 */
export default function ItemSearchCell({
  index, line = null, onSelect, onNotify, autoFocus = false,
}) {
  const { productEntries, labelEntries, isLoading } = index;
  const wrapRef = useRef(null);
  // The dropdown option currently highlighted (arrow keys or mouse hover), so
  // Tab can accept exactly that one.
  const highlightedRef = useRef(null);
  // null = not editing (field shows the line's own name); string = what the
  // cashier is typing right now.
  const [typing, setTyping] = useState(null);

  const query = typing ?? '';
  const inputValue = typing ?? (line?.name || '');

  const options = useMemo(() => {
    const q = norm(query);
    if (!q) return [];
    const fromProducts = productEntries
      .filter((e) => norm(e.code).includes(q) || norm(e.name).includes(q) || norm(e.product.shortId).includes(q));
    const fromLabels = labelEntries
      .filter((e) => norm(e.barcode).includes(q) || norm(e.code).includes(q) || norm(e.name).includes(q));
    return [...fromProducts, ...fromLabels].slice(0, MAX_OPTIONS);
  }, [query, productEntries, labelEntries]);

  const commit = (entry) => {
    setTyping(null);
    highlightedRef.current = null;
    onSelect(entry.code);
    // A blank row keeps its place at the bottom after a pick, so hand the
    // cursor straight back to the FIRST field of that row (the Barcode cell)
    // for the next scan.
    if (!line) focusFirstInputOfRow(wrapRef.current);
  };

  const findExact = (q) => (
    productEntries.find((e) => norm(e.code) === q)
    || productEntries.find((e) => e.product.shortId && norm(e.product.shortId) === q)
    || labelEntries.find((e) => norm(e.barcode) === q)
    || labelEntries.find((e) => norm(e.code) === q)
  );

  // Tab accepts what was typed: an exact code / Short ID / barcode match wins,
  // otherwise the top suggestion in the list is taken, so typing a Short ID or
  // the start of a name and pressing Tab fills the row's product details. On
  // the blank row the new line is added and focus returns to the fresh blank
  // row for the next item; on a filled row the item is swapped and Tab moves
  // on normally. Nothing typed / nothing found: Tab just moves focus.
  const handleTab = (e) => {
    if (e.key !== 'Tab' || e.shiftKey) return;
    const q = norm(query);
    if (!q) return;
    // Highlighted option wins (the user picked it with arrows / hover), then
    // an exact code / Short ID / barcode match, then the top suggestion.
    const highlighted = highlightedRef.current;
    const stillListed = highlighted
      && options.some((o) => o.code === highlighted.code && o.source === highlighted.source);
    const target = (stillListed ? highlighted : null) || findExact(q) || options[0];
    if (!target) {
      onNotify(`No item found for "${query.trim()}"`, 'warning');
      return;
    }
    if (!line) e.preventDefault();
    commit(target);
  };

  const resolveTyped = () => {
    const q = norm(query);
    if (!q) return;

    const exact = findExact(q);
    if (exact) { commit(exact); return; }

    const distinct = [...new Set(options.map((e) => e.code))];
    if (distinct.length === 1) { commit(options[0]); return; }
    if (distinct.length > 1) {
      onNotify(`${distinct.length} items match "${query.trim()}" — pick one from the list or type the exact code / barcode`, 'info');
      return;
    }
    onNotify(`No item found for "${query.trim()}"`, 'warning');
  };

  const currentOption = line
    ? { source: SOURCE_PRODUCT, code: line.code, name: line.name, barcode: '', product: null }
    : null;

  return (
    // Tab is caught in the capture phase on this wrapper (not on the
    // TextField) so it fires regardless of how the MUI version forwards
    // key handlers to the inner input.
    <Box ref={wrapRef} onKeyDownCapture={handleTab} sx={{ minWidth: 0, width: '100%' }}>
      <Autocomplete
        size="small"
        fullWidth
        freeSolo
        autoHighlight={false}
        clearOnBlur={false}
        disableClearable
        options={options}
        value={currentOption}
        inputValue={inputValue}
        loading={isLoading}
        filterOptions={(opts) => opts}
        groupBy={(option) => option.source}
        getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
        isOptionEqualToValue={(option, value) => option.code === value.code && option.source === value.source}
        onInputChange={(_e, value, reason) => {
          if (reason === 'input') {
            highlightedRef.current = null;
            setTyping(value);
          }
        }}
        onHighlightChange={(_e, option) => { highlightedRef.current = option; }}
        onBlur={() => setTyping(null)}
        onChange={(_e, value) => {
          if (!value) return;
          // Dropdown pick arrives as an object; Enter with nothing highlighted
          // (barcode scanner terminator) arrives as a string.
          if (typeof value === 'string') resolveTyped();
          else commit(value);
        }}
        noOptionsText="No matching items"
        renderOption={(props, option) => {
          const { key: _muiKey, ...optionProps } = props;
          return (
            <li key={`${option.source}-${option.code}-${option.barcode}`} {...optionProps}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', minWidth: 0 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" noWrap>{option.name}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {option.code}
                    {option.product.shortId ? ` · ID ${option.product.shortId}` : ''}
                    {option.barcode ? ` · ${option.barcode}` : ''}
                    {` · ${formatCurrency(Number(option.product.salePrice))} · ${option.product.availableQty} ${option.product.uom} in stock`}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  variant="outlined"
                  color={option.source === SOURCE_BARCODE ? 'primary' : 'default'}
                  label={option.source === SOURCE_BARCODE ? 'Barcode' : 'Product'}
                  sx={{ flexShrink: 0 }}
                />
              </Box>
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            size="small"
            autoFocus={autoFocus}
            placeholder="Scan Barcode or Search Item name / code"
            onFocus={(e) => { if (line) e.target.select(); }}
            slotProps={{
              ...params.slotProps,
              input: {
                ...params.slotProps?.input,
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              },
            }}
          />
        )}
      />
    </Box>
  );
}

/**
 * Editable Barcode cell for a Current Sale row. Shows the row's item barcode
 * (from Barcode & Label) and can also be used to enter an item: scan or type
 * a barcode and press Enter, and the row's item is set to the product that
 * barcode belongs to (on the blank row that adds a new line; on a filled row
 * it swaps that line's item). The barcode is only a lookup key — it is not
 * stored separately on the bill.
 */
export function BarcodeCell({
  index, line = null, onSelect, onNotify, autoFocus = false,
}) {
  const [typing, setTyping] = useState(null);
  const wrapRef = useRef(null);
  const shown = typing ?? (line ? (index.barcodeByCode[line.code] || '') : '');

  const resolve = () => {
    const q = norm(typing);
    setTyping(null);
    if (!q) return;
    const hit = index.labelEntries.find((e) => norm(e.barcode) === q);
    if (!hit) {
      onNotify(`No item found for barcode "${String(typing).trim()}"`, 'warning');
      return;
    }
    onSelect(hit.code);
    if (!line) focusFirstInputOfRow(wrapRef.current);
  };

  // Enter, or Tab, accepts a typed/scanned barcode; on the blank row Tab keeps
  // focus there so scanning can continue.
  const handleKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      resolve();
    } else if (e.key === 'Tab' && !e.shiftKey && norm(typing)) {
      if (!line) e.preventDefault();
      resolve();
    }
  };

  return (
    <Box ref={wrapRef} onKeyDownCapture={handleKey} sx={{ minWidth: 0, width: '100%' }}>
      <TextField
        size="small"
        fullWidth
        value={shown}
        placeholder="Scan Barcode"
        autoFocus={autoFocus}
        onChange={(e) => setTyping(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => setTyping(null)}
        slotProps={{ htmlInput: { inputMode: 'text', autoComplete: 'off' } }}
      />
    </Box>
  );
}
