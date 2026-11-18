import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid, Paper, Typography, IconButton, TextField,
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
 *
 * "No. of Prints" is a dialog-local override (not saved back to the batch):
 * typing 10 here repeats every item's barcode 10 times in the actual
 * printed output. The on-screen tiles above still show one tile per item so
 * the user can check the value/image is correct; the printed page itself
 * (see `.blp-print-area` below, kept off-screen until `window.print()`
 * fires) is the only thing that renders the repeated, buttons-free,
 * 2-column grid.
 */
export default function BarcodePrintDialog({
  open, onClose, batch, onGenerate, isGenerating,
}) {
  const items = batch?.items || [];
  const [printQty, setPrintQty] = useState('1');

  // Reset to the batch's own first item printQty (falling back to 1) every
  // time a different batch is previewed, rather than carrying over whatever
  // was last typed for a previous batch.
  useEffect(() => {
    if (!open) return;
    const firstQty = items[0]?.printQty;
    const parsed = Number(firstQty);
    setPrintQty(Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '1');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, batch?.id]);

  const qty = Math.max(1, Math.round(Number(printQty)) || 1);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Print / Preview{batch ? ` — ${batch.code}` : ''}</span>
        <IconButton onClick={onClose} size="small" aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <TextField
          label="No. of Prints"
          type="number"
          size="small"
          value={printQty}
          onChange={(e) => setPrintQty(e.target.value)}
          slotProps={{ htmlInput: { min: 1, step: 1 } }}
          sx={{ mb: 2, width: 160 }}
        />

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
                  Print Qty: {qty.toFixed(2)}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

      </DialogContent>

      {/* Printed output only, rendered through a portal straight onto
          document.body (as its own top-level child, a sibling of the app
          root and of MUI's own Dialog portal) rather than inside
          DialogContent.
          Hiding the rest of the page with `visibility: hidden` (the first
          attempt) still reserved every hidden element's layout height, so
          the real page content (app root + the Dialog's own backdrop/Paper)
          was still taking up space above this — that's what left the big
          blank gap on the printed page. The fix is to actually remove
          those siblings from layout with `display: none` instead (see the
          @media print rule below, which hides every direct child of body
          except this one) and let this area sit in normal, un-positioned
          flow — with nothing left above it, it starts right at the top of
          the page. Kept off-screen (not display:none) outside of print via
          `position: fixed` + a large negative left offset, so it doesn't
          show up on screen but is still around to actually print. Just the
          barcode images, repeated `qty` times per item, laid out 2 per row
          with as many rows as the page can take — no title, no item
          name/caption, no buttons. */}
      {open && createPortal(
        <>
          <div className="blp-print-area">
            <div className="blp-print-grid">
              {items.flatMap((item) => (
                Array.from({ length: qty }, (_, copyIndex) => (
                  <div className="blp-print-tile" key={`${item.id || item.itemCode}-${copyIndex}`}>
                    <BarcodeImage value={resolveItemValue(item)} barcodeType={batch?.barcodeType} />
                  </div>
                ))
              ))}
            </div>
          </div>
          <style>{`
            .blp-print-area { position: fixed; top: 0; left: -10000px; margin: 0; padding: 0; }
            @media print {
              body > *:not(.blp-print-area) { display: none !important; }
              .blp-print-area {
                display: block !important;
                position: static !important;
                left: auto !important;
                top: auto !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              .blp-print-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 10px;
                margin: 0;
              }
              .blp-print-tile {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 6px;
                break-inside: avoid;
                page-break-inside: avoid;
              }
            }
          `}
          </style>
        </>,
        document.body,
      )}
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
