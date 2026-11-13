import { useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Stack, Typography, Button,
  LinearProgress, Alert, Box, Chip, Table, TableHead, TableRow, TableCell, TableBody,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';

import { useAppDispatch } from '../../app/hooks';
import { showToast } from '../../features/ui/uiSlice';
import { readFirstSheet, chunkArray } from '../../utils/excel';

/**
 * Generic Excel/CSV import dialog (Download Template -> choose file -> review
 * -> Import -> per-row result), the same flow as the Product import.
 *
 * Props:
 *  - title, description, unitLabel ('suppliers', 'receipts', ...)
 *  - onDownloadTemplate(): writes the template workbook
 *  - parseRows(rawRows): turns the sheet's rows into the units sent to the API
 *      (throw an Error with a user-friendly message if the file is unusable).
 *      Each unit must carry `_row` (its sheet row) so errors can point at it.
 *  - sendChunk(units): POSTs one chunk and resolves to
 *      { total, created, updated, failed, errors: [{ row, ref?, message }] }
 *  - chunkSize: units per request
 */
export default function ExcelImportDialog({
  open, onClose, title, description, unitLabel = 'rows', onDownloadTemplate, parseRows, sendChunk, chunkSize = 100,
}) {
  const dispatch = useAppDispatch();
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [units, setUnits] = useState(null);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState(null);

  const resetState = () => {
    setFileName('');
    setUnits(null);
    setParseError('');
    setImporting(false);
    setProgress({ done: 0, total: 0 });
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (importing) return;
    resetState();
    onClose();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setParseError('');
    setUnits(null);
    setFileName(file.name);
    try {
      const rawRows = await readFirstSheet(file);
      if (!rawRows.length) {
        setParseError('The file has no data rows.');
        return;
      }
      setUnits(parseRows(rawRows));
    } catch (err) {
      setParseError(err?.userMessage || 'Could not read this file. Please upload a valid .xlsx, .xls or .csv file.');
    }
  };

  const handleImport = async () => {
    if (!units?.length) return;
    setImporting(true);
    setResult(null);
    const chunks = chunkArray(units, chunkSize);
    setProgress({ done: 0, total: chunks.length });

    const summary = {
      total: 0, created: 0, updated: 0, failed: 0, errors: [],
    };
    for (let i = 0; i < chunks.length; i += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const data = await sendChunk(chunks[i]);
        summary.total += data.total || 0;
        summary.created += data.created || 0;
        summary.updated += data.updated || 0;
        summary.failed += data.failed || 0;
        summary.errors.push(...(data.errors || []));
      } catch (err) {
        summary.total += chunks[i].length;
        summary.failed += chunks[i].length;
        summary.errors.push({ row: chunks[i][0]?._row, message: err?.data?.message || `Batch ${i + 1} failed to upload` });
      }
      setProgress({ done: i + 1, total: chunks.length });
    }

    setImporting(false);
    setResult(summary);
    const saved = summary.created + summary.updated;
    if (summary.failed === 0) dispatch(showToast(`Imported ${saved} ${unitLabel} successfully`, 'success'));
    else dispatch(showToast(`${saved} imported, ${summary.failed} failed — see details below`, 'warning'));
  };

  const progressPct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <UploadFileOutlinedIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{title}</Typography>
        </Stack>
        <IconButton onClick={handleClose} size="small" disabled={importing}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>{description}</Typography>

          <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Button variant="outlined" component="label" startIcon={<UploadFileOutlinedIcon fontSize="small" />} disabled={importing}>
              {fileName || 'Choose file'}
              <input ref={fileInputRef} type="file" hidden accept=".xlsx,.xls,.csv" onChange={handleFileChange} />
            </Button>
            <Button variant="text" startIcon={<FileDownloadOutlinedIcon fontSize="small" />} onClick={onDownloadTemplate}>
              Download Template
            </Button>
          </Stack>

          {parseError && <Alert severity="error">{parseError}</Alert>}
          {units && !result && <Alert severity="info">{units.length} {unitLabel} ready to import.</Alert>}

          {importing && (
            <Box>
              <LinearProgress variant="determinate" value={progressPct} sx={{ borderRadius: 1, height: 8 }} />
              <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                Uploading batch {progress.done} of {progress.total}…
              </Typography>
            </Box>
          )}

          {result && (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                <Chip label={`Total: ${result.total}`} size="small" />
                <Chip label={`Created: ${result.created}`} color="success" size="small" />
                {result.updated > 0 && <Chip label={`Updated: ${result.updated}`} color="info" size="small" />}
                <Chip label={`Failed: ${result.failed}`} color={result.failed ? 'error' : 'default'} size="small" />
              </Stack>
              {result.errors.length > 0 && (
                <Box sx={{ maxHeight: 240, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Row</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Ref</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Error</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {result.errors.map((err, i) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <TableRow key={`${err.row}-${i}`}>
                          <TableCell>{err.row ?? '—'}</TableCell>
                          <TableCell>{err.ref || '—'}</TableCell>
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
        <Button onClick={handleClose} disabled={importing}>{result ? 'Close' : 'Cancel'}</Button>
        {!result && (
          <Button variant="contained" onClick={handleImport} disabled={!units?.length || importing}>
            {importing ? 'Importing…' : `Import ${units?.length || ''} ${unitLabel}`}
          </Button>
        )}
        {result && <Button variant="contained" onClick={resetState}>Import Another File</Button>}
      </DialogActions>
    </Dialog>
  );
}
