import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Table, TableHead, TableBody, TableRow, TableCell, TextField, MenuItem,
  IconButton, Stack, Button, Typography, Alert,
} from '@mui/material';
import { Controller, useFormContext, useFieldArray, useWatch, useFormState } from 'react-hook-form';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';

import { useAppDispatch } from '../../../app/hooks';
import { showToast } from '../../../features/ui/uiSlice';
import ItemSearchCell, { useItemSearchIndex } from '../../line-sale/components/ItemSearchCell';

import FormDatePicker, { formatPickerDate } from '../../../components/form/FormDatePicker';
import { readFirstSheet } from '../../../utils/excel';
import SmartAddDialog from './SmartAddDialog';
import { downloadReceiptItemsTemplate, parseReceiptItemRows } from '../receiptItemsExcel';
import ItemCodeAutocomplete from '../../../components/form/ItemCodeAutocomplete';
import { useGetBarcodeLabelBatchesQuery } from '../../../api/barcodeLabelApi';
import { UOM_OPTIONS, WAREHOUSE_OPTIONS, emptyItemRow, isBlankItemRow } from '../createStockReceiptSchema';

// Only autofill the UoM select when the picked product's own uom matches one
// of this grid's fixed dropdown values — see IndentItemsTable's own comment.
function matchUom(value) {
  return UOM_OPTIONS.some((opt) => opt.value === value) ? value : '';
}

const COLUMNS = [
  { key: 'barcode', label: 'Barcode', minWidth: 150 },
  { key: 'itemCode', label: 'Item Code', minWidth: 150 },
  { key: 'itemName', label: 'Item Name', minWidth: 260 },
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

// Columns that grow with their content, and the widest each may become (px).
const CONTENT_CAP = {
  barcode: 260, itemCode: 220, itemName: 460, hsnCode: 180, uom: 140, warehouse: 200, batchNo: 220, remarks: 420,
};

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
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' });
  const dispatch = useAppDispatch();
  const fileInputRef = useRef(null);
  const [importIssues, setImportIssues] = useState([]);
  const [smartAddOpen, setSmartAddOpen] = useState(false);
  const { isDirty } = useFormState({ control });
  // Same Product master + Barcode & Label + Receipt search index the Line Sale
  // Item Name field uses, built once for the whole grid.
  const searchIndex = useItemSearchIndex(products);

  // itemCode -> barcode, taken from the Barcode & Label rows, so picking an
  // item pre-fills its Barcode cell (still editable afterwards).
  const { data: labelBatches = [] } = useGetBarcodeLabelBatchesQuery();
  const barcodeByCode = useMemo(() => {
    const byCode = {};
    labelBatches.forEach((batch) => {
      (batch.items || []).forEach((item) => {
        if (!item.barcode) return;
        if (!byCode[item.itemCode]) byCode[item.itemCode] = item.barcode;
      });
    });
    return byCode;
  }, [labelBatches]);

  // Column widths follow the longest value typed in that column (header
  // minimum up to a cap), so long names / codes / remarks are never cut off.
  const items = useWatch({ control, name: 'items' });
  const colWidths = useMemo(() => {
    const labelOf = (opts, v) => opts.find((o) => o.value === v)?.label || '';
    const widths = {};
    COLUMNS.forEach((col) => {
      let longest = 0;
      (items || []).forEach((row) => {
        let text = row?.[col.key];
        if (col.key === 'uom') text = labelOf(UOM_OPTIONS, text);
        if (col.key === 'warehouse') text = labelOf(WAREHOUSE_OPTIONS, text);
        longest = Math.max(longest, String(text ?? '').length);
      });
      const cap = CONTENT_CAP[col.key];
      widths[col.key] = cap ? Math.min(cap, Math.max(col.minWidth, longest * 9 + 64)) : col.minWidth;
    });
    return widths;
  }, [items]);

  // The grid starts with one row; as soon as the user puts an item on the last
  // row a fresh blank row is added below it. `isDirty` keeps this from firing
  // while an existing receipt is merely being loaded into the form (Edit).
  const lastFilled = Boolean(items?.length) && !isBlankItemRow(items[items.length - 1]);
  useEffect(() => {
    if (isDirty && lastFilled) append(emptyItemRow(), { shouldFocus: false });
  }, [isDirty, lastFilled, append]);

  // Finds a catalogue product by code, Short ID or (when no code is given) a
  // barcode saved on a Barcode & Label / Receipt row.
  const findProduct = (code, barcode) => {
    const c = String(code || '').trim().toLowerCase();
    if (c) {
      return products.find((p) => String(p.code || '').toLowerCase() === c)
        || products.find((p) => p.shortId && String(p.shortId).toLowerCase() === c) || null;
    }
    const b = String(barcode || '').trim().toLowerCase();
    if (!b) return null;
    const hit = searchIndex.labelEntries.find((e) => String(e.barcode).trim().toLowerCase() === b);
    return hit ? hit.product : null;
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    try {
      const raw = await readFirstSheet(file);
      const { rows, errors } = parseReceiptItemRows(raw, { findProduct, formatDate: formatPickerDate, emptyItemRow });
      setImportIssues(errors);
      if (!rows.length) {
        dispatch(showToast(errors.length ? 'No items were imported — see the issues below the grid' : 'The file has no item rows', 'error'));
        return;
      }
      // Keep the rows already filled in, add the imported ones, end on a blank row.
      const kept = (items || []).filter((r) => !isBlankItemRow(r));
      replace([...kept, ...rows, emptyItemRow()]);
      dispatch(showToast(`${rows.length} item${rows.length === 1 ? '' : 's'} imported${errors.length ? `, ${errors.length} skipped` : ''}`, errors.length ? 'warning' : 'success'));
    } catch (err) {
      dispatch(showToast(err?.userMessage || 'Could not read the file. Use the downloaded template (.xlsx or .csv).', 'error'));
    }
  };

  // Smart Add: every picked product becomes a row (qty 1 to start with),
  // placed after the rows already filled in, ending on a blank row.
  const handleSmartAdd = (chosen) => {
    const kept = (items || []).filter((r) => !isBlankItemRow(r));
    const added = chosen.map((product) => ({
      ...emptyItemRow({ orderedQty: '1.00', receivedQty: '1.00' }),
      itemCode: product.code,
      itemName: product.name || '',
      hsnCode: product.hsnSac || '',
      barcode: barcodeByCode[product.code] || '',
      uom: matchUom(product.uom),
    }));
    replace([...kept, ...added, emptyItemRow()]);
    dispatch(showToast(`${added.length} item${added.length === 1 ? '' : 's'} added`, 'success'));
  };
  const existingCodes = new Set((items || []).filter((r) => !isBlankItemRow(r)).map((r) => r.itemCode));

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Items</Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Button variant="contained" color="warning" size="small" startIcon={<AutoAwesomeOutlinedIcon fontSize="small" />} onClick={() => setSmartAddOpen(true)}>
            Smart Add
          </Button>
          <Button variant="outlined" color="inherit" size="small" startIcon={<FileDownloadOutlinedIcon fontSize="small" />} onClick={downloadReceiptItemsTemplate}>
            Download Template
          </Button>
          <Button variant="outlined" color="warning" size="small" startIcon={<UploadFileOutlinedIcon fontSize="small" />} onClick={() => fileInputRef.current?.click()}>
            Import Excel
          </Button>
          <input ref={fileInputRef} type="file" hidden accept=".xlsx,.xls,.csv" onChange={handleImportFile} />
        </Stack>
      </Stack>
      <SmartAddDialog open={smartAddOpen} onClose={() => setSmartAddOpen(false)} products={products} existingCodes={existingCodes} onAdd={handleSmartAdd} />
      {importIssues.length > 0 && (
        <Alert severity="warning" onClose={() => setImportIssues([])}>
          {importIssues.length} row{importIssues.length === 1 ? '' : 's'} skipped:
          {importIssues.slice(0, 8).map((i) => <div key={`${i.row}-${i.message}`}>Row {i.row}: {i.message}</div>)}
          {importIssues.length > 8 && <div>…and {importIssues.length - 8} more</div>}
        </Alert>
      )}
      <Box sx={{ overflowX: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Table size="small" sx={{ width: 'max-content', minWidth: '100%' }}>
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap', bgcolor: 'rgba(0,0,0,0.02)' } }}>
              <TableCell sx={{ width: 44 }}>#</TableCell>
              {COLUMNS.map((col) => (
                <TableCell key={col.key} sx={{ minWidth: colWidths[col.key], width: colWidths[col.key] }}>{col.label}</TableCell>
              ))}
              <TableCell sx={{ width: 60 }}>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {fields.map((field, index) => (
              <ItemRow key={field.id} index={index} control={control} onRemove={() => remove(index)} removable={fields.length > 1} products={products} barcodeByCode={barcodeByCode} searchIndex={searchIndex} />
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
  index, control, onRemove, removable, products, barcodeByCode, searchIndex,
}) {
  const { setValue } = useFormContext();
  const dispatch = useAppDispatch();
  const row = useWatch({ control, name: `items.${index}` });
  const totalCost = computeLineTotal(row);

  const fillFromProduct = (product, { barcode } = {}) => {
    setValue(`items.${index}.itemCode`, product.code, { shouldDirty: true, shouldValidate: true });
    setValue(`items.${index}.itemName`, product.name, { shouldDirty: true });
    setValue(`items.${index}.hsnCode`, product.hsnSac || '', { shouldDirty: true });
    setValue(`items.${index}.barcode`, barcode ?? (barcodeByCode[product.code] || ''), { shouldDirty: true });
    setValue(`items.${index}.uom`, matchUom(product.uom), { shouldDirty: true });
  };

  const lookupBarcode = (value) => {
    const q = String(value || '').trim().toLowerCase();
    if (!q || row?.itemCode) return;
    const hit = searchIndex.labelEntries.find((e) => String(e.barcode).trim().toLowerCase() === q);
    if (hit) fillFromProduct(hit.product, { barcode: String(value).trim() });
  };

  return (
    <TableRow sx={{ '& td': { py: 0.75 } }}>
      <TableCell sx={{ color: 'text.secondary' }}>{index + 1}</TableCell>
      <TableCell>
        {/* Plain text input — whatever is typed is saved with the receipt line
            and is then searchable in the Line Sale Barcode field. If the row
            has no item yet, a barcode that already belongs to a known item
            fills the row on Enter / leaving the field. */}
        <Controller
          name={`items.${index}.barcode`}
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              size="small"
              fullWidth
              placeholder="Scan / Enter Barcode"
              autoComplete="off"
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
          compact
          onSelectProduct={(product) => fillFromProduct(product)}
        />
      </TableCell>
      <TableCell>
        {/* Identical to the Line Sale Item Name field: scan / type a barcode,
            code, Short ID or name, pick from the grouped dropdown (Enter / Tab
            also accept a match). Passing a line object keeps it in the
            "filled row" mode so Tab moves on to the next cell. */}
        <ItemSearchCell
          wide
          index={searchIndex}
          line={{ code: row?.itemCode || '', name: row?.itemName || '' }}
          onNotify={(message, severity) => dispatch(showToast(message, severity))}
          onSelect={(code) => {
            const product = searchIndex.productByCode[code];
            if (product) fillFromProduct(product, { barcode: searchIndex.barcodeByCode[code] });
          }}
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
