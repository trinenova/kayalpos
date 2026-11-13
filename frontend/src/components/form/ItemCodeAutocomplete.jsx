import { Autocomplete, TextField, Box, Typography } from '@mui/material';
import { Controller } from 'react-hook-form';

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
 */
export default function ItemCodeAutocomplete({
  control, name, products = [], onSelectProduct, placeholder = 'Search Item Code', disabled = false, compact = false,
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const matched = products.find((p) => p.code === field.value);
        const value = matched || (field.value ? { code: field.value, name: '' } : null);

        return (
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
            slotProps={compact ? { popper: { placement: 'bottom-start', sx: { width: 'fit-content !important', minWidth: 320, maxWidth: 520 } } } : undefined}
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
      }}
    />
  );
}
