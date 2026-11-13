import { useMemo, useRef, useState } from 'react';
import {
  Box, Autocomplete, TextField, InputAdornment, IconButton, Typography, Chip, CircularProgress,
} from '@mui/material';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';

import { useGetBarcodeLabelBatchesQuery } from '../../../api/barcodeLabelApi';
import { formatCurrency } from '../../../utils/format';

const SOURCE_PRODUCT = 'Product master';
const SOURCE_BARCODE = 'Barcode & Label';
const MAX_OPTIONS = 25;

const norm = (v) => String(v ?? '').trim().toLowerCase();

/**
 * Item entry row for the top of the "Current Sale" table — replaces the
 * "Scan Barcode or Search Item name" box that used to sit in the top bar.
 *
 * Items are searched in TWO places and every result is tagged with where it
 * came from:
 *   1. Product master (Masters > Product)  — by product code or name.
 *   2. Barcode & Label (/barcode-label)    — by barcode, item code or item
 *      name on the label rows. The Product master has no barcode column, so
 *      a barcode printed from Barcode & Label is the only way a scanned code
 *      can map back to a product.
 * Both kinds resolve to a sellable (ACTIVE) product, and picking either one
 * adds that product to the cart via `onAddItem(productCode)`.
 *
 * Enter / the scanner button: exact match first (product code → barcode →
 * label item code), then a name match only when it narrows to a single
 * product; anything ambiguous or unknown raises `onNotify` instead of
 * guessing.
 */
export default function ItemSearchRow({ products = [], onAddItem, onNotify }) {
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);

  const { data: batches = [], isLoading: isLoadingLabels } = useGetBarcodeLabelBatchesQuery();

  const productByCode = useMemo(
    () => Object.fromEntries(products.map((p) => [p.code, p])),
    [products],
  );

  // Flatten every label row of every batch into one searchable list. The same
  // item/barcode is usually printed in several batches, so de-dupe on
  // itemCode + barcode. Rows whose item is not an active product are dropped
  // (nothing sellable to add).
  const labelEntries = useMemo(() => {
    const seen = new Set();
    const out = [];
    batches.forEach((batch) => {
      (batch.items || []).forEach((item) => {
        const product = productByCode[item.itemCode];
        if (!product) return;
        const key = `${item.itemCode}|${item.barcode || ''}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({
          source: SOURCE_BARCODE,
          code: product.code,
          name: product.name,
          barcode: item.barcode || '',
          product,
        });
      });
    });
    return out;
  }, [batches, productByCode]);

  const productEntries = useMemo(
    () => products.map((p) => ({
      source: SOURCE_PRODUCT, code: p.code, name: p.name, barcode: '', product: p,
    })),
    [products],
  );

  const options = useMemo(() => {
    const q = norm(query);
    if (!q) return [];
    const fromProducts = productEntries
      .filter((e) => norm(e.code).includes(q) || norm(e.name).includes(q));
    const fromLabels = labelEntries
      .filter((e) => norm(e.barcode).includes(q) || norm(e.code).includes(q) || norm(e.name).includes(q));
    // Product-master results first, so the grouped dropdown reads in order.
    return [...fromProducts, ...fromLabels].slice(0, MAX_OPTIONS);
  }, [query, productEntries, labelEntries]);

  const reset = () => {
    setQuery('');
    // Keep the cursor in the field so the next scan lands straight in it.
    setTimeout(() => wrapRef.current?.querySelector('input')?.focus(), 0);
  };

  const addEntry = (entry) => {
    onAddItem(entry.code);
    reset();
  };

  const resolveTypedQuery = () => {
    const q = norm(query);
    if (!q) return;

    const byCode = productEntries.find((e) => norm(e.code) === q);
    if (byCode) { addEntry(byCode); return; }

    const byBarcode = labelEntries.find((e) => norm(e.barcode) === q);
    if (byBarcode) { addEntry(byBarcode); return; }

    const byLabelCode = labelEntries.find((e) => norm(e.code) === q);
    if (byLabelCode) { addEntry(byLabelCode); return; }

    const distinctCodes = [...new Set(options.map((e) => e.code))];
    if (distinctCodes.length === 1) { addEntry(options[0]); return; }
    if (distinctCodes.length > 1) {
      onNotify(`${distinctCodes.length} items match "${query.trim()}" — pick one from the list or type the exact code / barcode`, 'info');
      return;
    }
    onNotify(`No item found for "${query.trim()}"`, 'warning');
  };

  return (
    <Box ref={wrapRef} sx={{ px: 2.5, pb: 1.5 }}>
      <Autocomplete
        size="small"
        fullWidth
        freeSolo
        autoHighlight={false}
        clearOnBlur={false}
        options={options}
        inputValue={query}
        value={null}
        loading={isLoadingLabels}
        filterOptions={(opts) => opts}
        groupBy={(option) => option.source}
        getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
        isOptionEqualToValue={(option, value) => Boolean(value) && option.code === value.code && option.source === value.source}
        onInputChange={(_e, value, reason) => {
          // Autocomplete fires 'reset' right after a selection; ignore it so
          // the empty string we just set isn't overwritten with the old text.
          if (reason === 'reset') return;
          setQuery(value);
        }}
        onChange={(_e, value) => {
          if (!value) return;
          // A picked dropdown option arrives as an object; Enter with nothing
          // highlighted (a barcode scanner's terminator) arrives as a string.
          if (typeof value === 'string') resolveTypedQuery();
          else addEntry(value);
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
            autoFocus
            placeholder="Scan Barcode or Search Item name / code"
            slotProps={{
              ...params.slotProps,
              input: {
                ...params.slotProps?.input,
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <>
                    {isLoadingLabels ? <CircularProgress color="inherit" size={16} sx={{ mr: 1 }} /> : null}
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={resolveTypedQuery}>
                        <QrCodeScannerOutlinedIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                    {params.slotProps?.input?.endAdornment}
                  </>
                ),
              },
            }}
          />
        )}
      />
    </Box>
  );
}
