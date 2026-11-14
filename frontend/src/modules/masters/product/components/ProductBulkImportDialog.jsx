import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  Stack, Typography, Button, LinearProgress, Alert, Box, Chip,
  Table, TableHead, TableRow, TableCell, TableBody,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';

import { useAppDispatch } from '../../../../app/hooks';
import { showToast } from '../../../../features/ui/uiSlice';
import { useProductBulkImportMutation } from '../../../../api/productApi';

const CHUNK_SIZE = 200;
// Column headers accepted in the uploaded sheet, mapped to the API's field
// names. Matching is case-insensitive and ignores surrounding whitespace so
// a spreadsheet exported from Excel ("Product Name", "Sale Price", ...)
// still lines up without the user having to rename headers by hand.
const HEADER_MAP = {
  code: 'code',
  'product code': 'code',
  shortid: 'shortId',
  'short id': 'shortId',
  name: 'name',
  'product name': 'name',
  group: 'group',
  'product group': 'group',
  producttype: 'productType',
  'product type': 'productType',
  brand: 'brand',
  uom: 'uom',
  hsnsac: 'hsnSac',
  'hsn/sac': 'hsnSac',
  taxcode: 'taxCode',
  'tax code': 'taxCode',
  saleprice: 'salePrice',
  'sale price': 'salePrice',
  mrp: 'mrp',
  availableqty: 'availableQty',
  'available qty': 'availableQty',
  qty: 'availableQty',
  status: 'status',
  barcode: 'barcode',
  'bar code': 'barcode',
  'unit price': 'unitPrice',
  unitprice: 'unitPrice',
  'pack size': 'packSize',
  packsize: 'packSize',
  'product sub group': 'productSubGroup',
  'foreign name': 'foreignName',
  'tax group': 'taxGroup',
  remarks: 'remarks',
  'additional identifier': 'additionalIdentifier',
  'preferred vendor': 'preferredVendor',
  'purchasing uom': 'purchasingUom',
  'sales uom': 'salesUom',
};

function normalizeHeader(header) {
  return String(header || '').trim().toLowerCase();
}

// Converts one parsed spreadsheet row (arbitrary header casing/spacing,
// numeric-looking values as strings) into the shape the backend's
// bulkProductRowSchema expects. Blank cells are dropped rather than sent as
// empty strings, so zod's `.optional()`/`.default()` behavior kicks in
// exactly as it would for a hand-typed form.
function normalizeRow(rawRow) {
  const row = {};
  Object.entries(rawRow).forEach(([key, value]) => {
    const field = HEADER_MAP[normalizeHeader(key)];
    if (!field) return;
    if (value === undefined || value === null || value === '') return;
    row[field] = value;
  });
  return row;
}

// Friendly column headers for the downloadable template — one canonical
// spelling per field, taken straight from HEADER_MAP's keys above (plus a
// one-row example) so a sheet filled in from this template round-trips
// through normalizeRow without the user needing to guess column names.
const TEMPLATE_HEADERS = [
  'Product Code', 'Short ID', 'Product Name', 'Product Group', 'Product Type', 'Brand',
  'UOM', 'HSN/SAC', 'Tax Code', 'Sale Price', 'MRP', 'Available Qty', 'Status',
];
const TEMPLATE_EXAMPLE_ROW = [
  '', 'RICE5KG', 'India Gate Basmati Rice 5kg', 'Grocery', 'Finished Goods', 'India Gate',
  'PCS', '10063010', 'GST 5%', 550, 600, 125, 'Active',
];

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * Bulk Excel/CSV import for the Product master. Parses the file entirely
 * client-side (SheetJS), then POSTs it to the backend in fixed-size chunks
 * (see product.routes.js's POST /bulk) so a large sheet — up to the backend's
 * 500-rows-per-request cap — never needs one giant request or a table lock.
 * Each chunk's response is merged into a running results summary; a failure
 * on one chunk does not stop the remaining chunks, since bad rows within a
 * chunk are already isolated server-side.
 */
export default function ProductBulkImportDialog({ open, onClose }) {
  const dispatch = useAppDispatch();
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState(null);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState(null);

  const [bulkImport] = useProductBulkImportMutation();

  const resetState = () => {
    setFileName('');
    setParsedRows(null);
    setParseError('');
    setImporting(false);
    setProgress({ done: 0, total: 0 });
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (importing) return; // don't allow closing mid-import
    resetState();
    onClose();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setParseError('');
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
      if (!rawRows.length) {
        setParseError('The file has no data rows.');
        setParsedRows(null);
        return;
      }
      const rows = rawRows.map(normalizeRow).filter((row) => Object.keys(row).length > 0);
      if (!rows.length) {
        setParseError('No recognizable columns found. Expected headers like Name, Group, UOM, Sale Price, MRP, Available Qty.');
        setParsedRows(null);
        return;
      }
      setParsedRows(rows);
    } catch (err) {
      setParseError('Could not read this file. Please upload a valid .xlsx, .xls or .csv file.');
      setParsedRows(null);
    }
  };

  // Blank workbook with just the expected column headers (plus one example
  // row showing the expected value shapes) — lets the user start from a
  // sheet that's guaranteed to match normalizeRow's HEADER_MAP instead of
  // guessing column names from the help text above.
  const handleDownloadTemplate = () => {
    const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, TEMPLATE_EXAMPLE_ROW]);
    sheet['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(h.length + 2, 12) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Products');
    XLSX.writeFile(workbook, 'Product_Import_Template.xlsx');
  };

  const handleImport = async () => {
    if (!parsedRows?.length) return;
    setImporting(true);
    setResult(null);
    const chunks = chunkArray(parsedRows, CHUNK_SIZE);
    setProgress({ done: 0, total: chunks.length });

    const summary = { total: 0, created: 0, updated: 0, failed: 0, errors: [] };
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      const isLast = i === chunks.length - 1;
      try {
        // eslint-disable-next-line no-await-in-loop
        const data = await bulkImport({ rows: chunk, invalidate: isLast }).unwrap();
        summary.total += data.total;
        summary.created += data.created;
        summary.updated += data.updated;
        summary.failed += data.failed;
        // Row numbers from the backend are 1-based WITHIN the chunk — offset
        // them so the summary reflects the row's position in the whole file.
        const offset = i * CHUNK_SIZE;
        summary.errors.push(...data.errors.map((err) => ({ ...err, row: err.row + offset })));
      } catch (err) {
        summary.failed += chunk.length;
        summary.errors.push({ row: i * CHUNK_SIZE + 1, message: err?.data?.message || `Chunk ${i + 1} failed to upload` });
      }
      setProgress({ done: i + 1, total: chunks.length });
    }

    setImporting(false);
    setResult(summary);
    if (summary.failed === 0) {
      dispatch(showToast(`Imported ${summary.created + summary.updated} products successfully`, 'success'));
    } else {
      dispatch(showToast(`Imported with ${summary.failed} row(s) failed — see details below`, 'warning'));
    }
  };

  const progressPct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <UploadFileOutlinedIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Import Products</Typography>
        </Stack>
        <IconButton onClick={handleClose} size="small" disabled={importing}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Upload an .xlsx, .xls or .csv file with columns such as Name, Short ID, Group, Product Type, Brand, UOM, HSN/SAC,
            Tax Code, Sale Price, MRP, Available Qty and Status. Rows with an existing Product Code
            update that product; rows without one are created as new products.
          </Typography>

          <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadFileOutlinedIcon fontSize="small" />}
              disabled={importing}
            >
              {fileName || 'Choose file'}
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
              />
            </Button>
            <Button
              variant="text"
              startIcon={<FileDownloadOutlinedIcon fontSize="small" />}
              onClick={handleDownloadTemplate}
            >
              Download Template
            </Button>
          </Stack>

          {parseError && <Alert severity="error">{parseError}</Alert>}

          {parsedRows && !result && (
            <Alert severity="info">{parsedRows.length} row(s) ready to import.</Alert>
          )}

          {importing && (
            <Box>
              <LinearProgress variant="determinate" value={progressPct} sx={{ borderRadius: 1, height: 8 }} />
              <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                Uploading chunk {progress.done} of {progress.total}…
              </Typography>
            </Box>
          )}

          {result && (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                <Chip label={`Total: ${result.total}`} size="small" />
                <Chip label={`Created: ${result.created}`} color="success" size="small" />
                <Chip label={`Updated: ${result.updated}`} color="info" size="small" />
                <Chip label={`Failed: ${result.failed}`} color={result.failed ? 'error' : 'default'} size="small" />
              </Stack>

              {result.errors.length > 0 && (
                <Box sx={{ maxHeight: 220, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Row</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Error</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {result.errors.map((err) => (
                        <TableRow key={`${err.row}-${err.code || ''}`}>
                          <TableCell>{err.row}</TableCell>
                          <TableCell>{err.code || '—'}</TableCell>
                          <TableCell>{err.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </Stack>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={importing}>
          {result ? 'Close' : 'Cancel'}
        </Button>
        {!result && (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={!parsedRows?.length || importing}
          >
            {importing ? 'Importing…' : `Import ${parsedRows?.length || ''} Row(s)`}
          </Button>
        )}
        {result && (
          <Button variant="contained" onClick={resetState}>
            Import Another File
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
