import { useMemo } from 'react';
import {
  Box, Table, TableHead, TableBody, TableRow, TableCell, TextField, MenuItem,
  IconButton, Stack, Button,
} from '@mui/material';
import { Controller, useFormContext, useFieldArray, useWatch } from 'react-hook-form';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import AddIcon from '@mui/icons-material/Add';

import FormDatePicker from '../../../components/form/FormDatePicker';
import ItemCodeAutocomplete from '../../../components/form/ItemCodeAutocomplete';
import { useGetBarcodeLabelBatchesQuery } from '../../../api/barcodeLabelApi';
import { UOM_OPTIONS, WAREHOUSE_OPTIONS, emptyItemRow } from '../createStockReceiptSchema';

// Only autofill the UoM select when the picked product's own uom matches one
// of this grid's fixed dropdown values — see IndentItemsTable's own comment.
function matchUom(value) {
  return UOM_OPTIONS.some((opt) => opt.value === value) ? value : '';
}

const COLUMNS = [
  { key: 'barcode', label: 'Barcode', minWidth: 150 },
  { key: 'itemCode', label: 'Item Code', minWidth: 150 },
  { key: 'itemName', label: 'Item Name', minWidth: 150 },
  { key: 'hsnCode', label: 'HSN Code', minWidth: 110 },
  { key: 'uom', label: 'UoM', minWidth: 100 },
  { key: 'orderedQty', label: 'Ordered Qty', minWidth: 100 },
  { key: 'receivedQty', label: 'Received Qty *', minWidth: 110 },
  { key: 'unitCost', label: 'Unit Cost (₹)', minWidth: 110 },
  { key: 'discount', label: 'Discount (%)', minWidth: 100 },
  { key: 'tax', label: 'Tax (%)', minWidth: 90 },
  { key: 'totalCost', label: 'Total Cost (₹)', minWidth: 120 },
  { key: 'warehouse', label: 'Warehouse *', minWidth: 140 },
  { key: 'batchNo', label: 'Batch No.', minWidth: 110 },
  { key: 'expiryDate', label: 'Expiry Date', minWidth: 130 },
  { key: 'remarks', label: 'Remarks', minWidth: 140 },
];

function toNumber(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

// receivedQty * unitCost, less the line discount, plus tax on the
// discounted amount — same total-cost math a purchase/GRN line normally
// uses, and the computed cell is shaded read-only like the other create
// forms' derived columns.
export function computeLineTotal(row) {
  const base = toNumber(row.receivedQty) * toNumber(row.unitCost);
  const afterDiscount = base - (base * toNumber(row.discount)) / 100;
  return afterDiscount + (afterDiscount * toNumber(row.tax)) / 100;
}

/**
 * Inline, editable line-items grid for the Create Stock Receipt form —
 * spreadsheet-style row entry matching TransferItemsTable/IndentItemsTable,
 * extended with Ordered Qty, Discount %, Tax %, Warehouse, Batch No. and
 * Expiry Date columns (and a computed Total Cost) to match the reference
 * design's Stock Receipt grid.
 */
export default function ReceiptItemsTable({ onAddItem, products = [] }) {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  // itemCode -> barcode, taken from the Barcode & Label rows, so picking an
  // item pre-fills its Barcode cell (still editable afterwards).
  const { data: labelBatches = [] } = useGetBarcodeLabelBatchesQuery();
  const { barcodeByCode, codeByBarcode } = useMemo(() => {
    const byCode = {};
    const byBarcode = {};
    labelBatches.forEach((batch) => {
      (batch.items || []).forEach((item) => {
        if (!item.barcode) return;
        if (!byCode[item.itemCode]) byCode[item.itemCode] = item.barcode;
        if (!byBarcode[item.barcode]) byBarcode[item.barcode] = item.itemCode;
      });
    });
    return { barcodeByCode: byCode, codeByBarcode: byBarcode };
  }, [labelBatches]);

  return (
    <Stack spacing={1.5}>
      <Box sx={{ overflowX: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Table size="small" sx={{ minWidth: 1650 }}>
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap', bgcolor: 'rgba(0,0,0,0.02)' } }}>
              <TableCell sx={{ width: 44 }}>#</TableCell>
              {COLUMNS.map((col) => (
                <TableCell key={col.key} sx={{ minWidth: col.minWidth }}>{col.label}</TableCell>
              ))}
              <TableCell sx={{ width: 60 }}>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {fields.map((field, index) => (
              <ItemRow key={field.id} index={index} control={control} onRemove={() => remove(index)} removable={fields.length > 1} products={products} barcodeByCode={barcodeByCode} codeByBarcode={codeByBarcode} />
            ))}
          </TableBody>
        </Table>
      </Box>

      <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          color="warning"
          size="small"
          startIcon={<AddIcon fontSize="small" />}
          onClick={() => append(emptyItemRow())}
        >
          Add Row
        </Button>
        <Button
          variant="outlined"
          color="warning"
          size="small"
          startIcon={<AddIcon fontSize="small" />}
          onClick={onAddItem}
        >
          Add Item
        </Button>
      </Stack>
    </Stack>
  );
}

function ItemRow({
  index, control, onRemove, removable, products, barcodeByCode, codeByBarcode,
}) {
  const { setValue } = useFormContext();
  const row = useWatch({ control, name: `items.${index}` });
  const totalCost = computeLineTotal(row);

  const fillFromProduct = (product, { barcode } = {}) => {
    setValue(`items.${index}.itemCode`, product.code, { shouldDirty: true, shouldValidate: true });
    setValue(`items.${index}.itemName`, product.name, { shouldDirty: true });
    setValue(`items.${index}.hsnCode`, product.hsnSac || '', { shouldDirty: true });
    setValue(`items.${index}.barcode`, barcode ?? (barcodeByCode[product.code] || ''), { shouldDirty: true });
    setValue(`items.${index}.uom`, matchUom(product.uom), { shouldDirty: true });
  };

  // Barcode is the first field of the row: a scanned/typed barcode that
  // exists in Barcode & Label fills the item details (Enter, Tab or leaving
  // the field). An unknown barcode is kept as typed.
  const lookupBarcode = (value) => {
    const code = codeByBarcode[String(value || '').trim()];
    const product = code ? products.find((p) => p.code === code) : null;
    if (product && row?.itemCode !== product.code) fillFromProduct(product, { barcode: String(value).trim() });
  };

  return (
    <TableRow sx={{ '& td': { py: 0.75 } }}>
      <TableCell sx={{ color: 'text.secondary' }}>{index + 1}</TableCell>
      <TableCell>
        <Controller
          name={`items.${index}.barcode`}
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              size="small"
              fullWidth
              placeholder="Scan / Enter Barcode"
              onBlur={(e) => { field.onBlur(); lookupBarcode(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  lookupBarcode(e.target.value);
                }
              }}
            />
          )}
        />
      </TableCell>
      <TableCell>
        <ItemCodeAutocomplete
          control={control}
          name={`items.${index}.itemCode`}
          products={products}
          onSelectProduct={(product) => fillFromProduct(product)}
        />
      </TableCell>
      <TableCell>
        <Controller
          name={`items.${index}.itemName`}
          control={control}
          render={({ field }) => <TextField {...field} size="small" fullWidth placeholder="Enter Item Name" />}
        />
      </TableCell>
      <TableCell>
        <Controller
          name={`items.${index}.hsnCode`}
          control={control}
          render={({ field }) => <TextField {...field} size="small" fullWidth placeholder="Enter HSN Code" />}
        />
      </TableCell>
      <TableCell>
        <Controller
          name={`items.${index}.uom`}
          control={control}
          render={({ field }) => (
            <TextField {...field} select size="small" fullWidth>
              {UOM_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</MenuItem>
              ))}
            </TextField>
          )}
        />
      </TableCell>
      <TableCell>
        <Controller
          name={`items.${index}.orderedQty`}
          control={control}
          render={({ field }) => <TextField {...field} size="small" fullWidth placeholder="0.00" inputMode="decimal" />}
        />
      </TableCell>
      <TableCell>
        <Controller
          name={`items.${index}.receivedQty`}
          control={control}
          render={({ field }) => <TextField {...field} size="small" fullWidth placeholder="0.00" inputMode="decimal" />}
        />
      </TableCell>
      <TableCell>
        <Controller
          name={`items.${index}.unitCost`}
          control={control}
          render={({ field }) => <TextField {...field} size="small" fullWidth placeholder="0.00" inputMode="decimal" />}
        />
      </TableCell>
      <TableCell>
        <Controller
          name={`items.${index}.discount`}
          control={control}
          render={({ field }) => <TextField {...field} size="small" fullWidth placeholder="0.00" inputMode="decimal" />}
        />
      </TableCell>
      <TableCell>
        <Controller
          name={`items.${index}.tax`}
          control={control}
          render={({ field }) => <TextField {...field} size="small" fullWidth placeholder="0.00" inputMode="decimal" />}
        />
      </TableCell>
      <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap', bgcolor: 'rgba(0,0,0,0.03)' }}>
        {totalCost.toFixed(2)}
      </TableCell>
      <TableCell>
        <Controller
          name={`items.${index}.warehouse`}
          control={control}
          render={({ field }) => (
            <TextField {...field} select size="small" fullWidth>
              {WAREHOUSE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</MenuItem>
              ))}
            </TextField>
          )}
        />
      </TableCell>
      <TableCell>
        <Controller
          name={`items.${index}.batchNo`}
          control={control}
          render={({ field }) => <TextField {...field} size="small" fullWidth placeholder="Enter Batch No." />}
        />
      </TableCell>
      <TableCell>
        <FormDatePicker name={`items.${index}.expiryDate`} placeholder="Select Date" size="small" />
      </TableCell>
      <TableCell>
        <Controller
          name={`items.${index}.remarks`}
          control={control}
          render={({ field }) => <TextField {...field} size="small" fullWidth placeholder="Enter Remarks" />}
        />
      </TableCell>
      <TableCell>
        <IconButton size="small" onClick={onRemove} disabled={!removable} aria-label="Remove row">
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}
