import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid, Paper, Typography, IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import AutorenewOutlinedIcon from '@mui/icons-material/AutorenewOutlined';

import BarcodeImage from './BarcodeImage';

// Mirrors generateBarcodesForBatch's own resolveBarcodeValue on the backend
// — the preview has to show the exact same value "Generate & Save to
// History" is about to log, not a different guess. `item.barcode` here is
// the batch's real saved BarcodeLabelItem.barcode column (null/empty when
// nothing was entered/picked), so the fallback to itemCode is identical to
// the backend's.
function resolveItemValue(item) {
  const explicit = item.barcode && String(item.barcode).trim();
  return explicit || item.itemCode;
}

/**
 * The real "Print / Preview" screen for a saved Barcode & Label batch —
 * every tile renders that item's actual scannable barcode/QR image (see
 * BarcodeImage), not a placeholder box. Takes the raw batch object exactly
 * as the backend returns it (GET /barcode-labels/:id, or the `batch` the
 * create/update/generate endpoints return) — not the display-mapped shape
 * barcodeLabelDisplay.js builds for the table/details card — because it
 * needs the item rows' real `barcode`/`itemCode` and the batch's raw
 * `barcodeType` value ('ean-13'/'code-128'/'upc-a'/'qr'), not their
 * human-readable labels.
 *
 * "Generate & Save to History" is the one action that actually calls POST
 * /barcode-labels/:id/generate: it logs every item's resolved barcode value
 * to the permanent Barcode History log and flips the batch to 'printed'
 * (see generateBarcodesForBatch). Print alone never does either, so
 * previewing/reprinting a batch any number of times doesn't spam the
 * history with duplicate entries — only an explicit Generate does.
 */
export default function BarcodePrintDialog({
  open, onClose, batch, onGenerate, isGenerating,
}) {
  const items = batch?.items || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Print / Preview{batch ? ` — ${batch.code}` : ''}</span>
        <IconButton onClick={onClose} size="small" aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          {items.length === 0 && (
            <Grid size={12}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No items in this batch yet.
              </Typography>
            </Grid>
          )}
          {items.map((item) => (
            <Grid key={item.id || item.itemCode} size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 0.5 }} noWrap>
                  {item.itemName}
                </Typography>
                <BarcodeImage value={resolveItemValue(item)} barcodeType={batch.barcodeType} />
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
                  Print Qty: {Number(item.printQty).toFixed(2)}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">Close</Button>
        <Button
          variant="outlined"
          startIcon={<AutorenewOutlinedIcon fontSize="small" />}
          onClick={onGenerate}
          disabled={isGenerating || items.length === 0}
        >
          Generate &amp; Save to History
        </Button>
        <Button
          variant="contained"
          startIcon={<PrintOutlinedIcon fontSize="small" />}
          onClick={() => window.print()}
          disabled={items.length === 0}
        >
          Print
        </Button>
      </DialogActions>
    </Dialog>
  );
}
