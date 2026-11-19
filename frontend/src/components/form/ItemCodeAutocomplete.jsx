import { useState } from 'react';
import { Autocomplete, TextField, Box, Typography } from '@mui/material';
import { Controller } from 'react-hook-form';

// autoExpand sizing: the field never drops below AUTO_EXPAND_MIN_WIDTH (so it
// stays large even when empty or holding a short code) and grows with the
// longest of the selected code / what's being typed. The width is measured by
// the browser from a hidden sizer that uses the input's own typography (no
// character-width guessing, so uppercase/hyphenated codes are never cut), plus
// a fixed allowance for the input padding and the clear/dropdown icons.
export const AUTO_EXPAND_MIN_WIDTH = 220;
const AUTO_EXPAND_ICON_ALLOWANCE = 88;

/**
 * Item Code cell for every line-items grid across the app (Stock Indent/
 * Transfer/Receipt/Return/Wastage/Count, Sales Quotation/Order/Invoice,
 * Barcode & Label) — a searchable select bound to the real Product master
 * instead of a plain free-text field, so a row's item can only ever be one
 * of the tenant's actual products, never an arbitrary typed string that
 * doesn't exist in the catalog.
 *
 * `products` is the real list from useGetProductsQuery (or an array built
 * from a `productByCode` map some pages already keep for their own Available
 * Qty/Unit Cost lookups). Selecting an option calls `onSelectProduct` with
 * the full product record so the row's own itemName/HSN/UoM can be
 * autofilled from it (see each *ItemsTable's ItemRow) — quantities, costs
 * and prices are never touched here, since those stay whatever figure the
 * user is keying in for that specific transaction/line.
 *
 * If the row's current itemCode doesn't match anything in `products` (a
 * legacy row, or the catalog hasn't loaded yet), the raw code is still shown
 * as free-standing text rather than silently blanking the field.
 *
 * `autoExpand` (opt-in, used by Barcode & Label): the field keeps a large
 * minimum width and widens to fit its content instead of truncating to "P…".
 */
export default function ItemCodeAutocomplete({
  control, name, products = [], onSelectProduct, placeholder = 'Search Item Code', disabled = false, compact = false, autoExpand = false,
}) {
  const [typed, setTyped] = useState('');

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const matched = products.find((p) => p.code === field.value);
        const value = matched || (field.value ? { code: field.value, name: '' } : null);

        const sizerText = (typed.length > (matched?.code || field.value || '').length
          ? typed
          : (matched?.code || field.value || ''));

        const autocomplete = (
          <Autocomplete
            size="small"
            fullWidth
            disabled={disabled}
            options={products}
            value={value}
            onBlur={field.onBlur}
            // compact: the input shows just the code (so it never gets cut to
            // "PR…") while the dropdown opens wider than the cell and lists
            // "code — name" in full.
            getOptionLabel={(opt) => (compact ? (opt?.code || '') : (opt?.name ? `${opt.code} — ${opt.name}` : (opt?.code || '')))}
            // The dropdown always opens at least as wide as its text needs
            // (not locked to the narrow grid cell), so codes and names are
            // never squeezed into a wrapped column.
            slotProps={{ popper: { placement: 'bottom-start', sx: { width: 'fit-content !important', minWidth: 320, maxWidth: 520 } } }}
            renderOption={compact ? (props, opt) => {
              const { key, ...rest } = props;
              return (
                <li key={key} {...rest}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{opt.code}</Typography>
                    <Typography variant="caption" color="text.secondary">{opt.name}</Typography>
                  </Box>
                </li>
              );
            } : undefined}
            isOptionEqualToValue={(opt, val) => opt.code === val?.code}
            onInputChange={autoExpand ? (_e, text) => setTyped(text || '') : undefined}
            onChange={(_e, newValue) => {
              field.onChange(newValue?.code || '');
              if (newValue) onSelectProduct?.(newValue);
            }}
            renderInput={(params) => (
              <TextField {...params} placeholder={placeholder} fullWidth />
            )}
            noOptionsText="No matching products"
          />
        );

        if (!autoExpand) return autocomplete;
        // width: max-content (driven by the hidden sizer) makes the table
        // column widen with the content; minWidth keeps it large when the
        // content is short or empty, and 100% lets it fill a wider cell.
        return (
          <Box sx={{ position: 'relative', width: 'max-content', minWidth: `max(100%, ${AUTO_EXPAND_MIN_WIDTH}px)` }}>
            <Box
              component="span"
              aria-hidden
              sx={{
                typography: 'body1',
                display: 'block',
                height: 0,
                overflow: 'hidden',
                visibility: 'hidden',
                whiteSpace: 'pre',
                pr: `${AUTO_EXPAND_ICON_ALLOWANCE}px`,
              }}
            >
              {sizerText}
            </Box>
            {autocomplete}
          </Box>
        );
      }}
    />
  );
}
