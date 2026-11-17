import { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

// jsbarcode's own format names for the three linear types this module
// offers (see BARCODE_TYPE_OPTIONS in createBarcodeLabelSchema.js) — 'qr'
// isn't a jsbarcode format at all and is rendered separately below via the
// `qrcode` package instead.
const JSBARCODE_FORMAT = { 'ean-13': 'EAN13', 'code-128': 'CODE128', 'upc-a': 'UPC' };

// EAN-13/UPC-A are check-digit formats that only accept a fixed-length
// numeric string (12-13 / 11-12 digits) — a plain item code like "SKU-001"
// fails that outright. Rather than silently crash or print a blank label,
// a value that doesn't fit its chosen format's numeric rule still gets a
// real, scannable barcode: it falls back to CODE-128, which accepts any
// alphanumeric value. EAN-13/UPC-A are therefore only actually used when
// the resolved value is a real, already-correct numeric code (e.g. one
// carried over from the Product master's own Barcode field).
const NUMERIC_RULE = {
  'ean-13': /^\d{12,13}$/,
  'upc-a': /^\d{11,12}$/,
};

function resolveFormat(barcodeType, value) {
  const rule = NUMERIC_RULE[barcodeType];
  if (rule && !rule.test(value)) return 'CODE128';
  return JSBARCODE_FORMAT[barcodeType] || 'CODE128';
}

/**
 * Renders one item's actual scannable barcode (or QR code) from its real
 * resolved value — used by BarcodePrintDialog for printing/preview and by
 * BarcodeHistoryPage for each history row's thumbnail. Pure client-side
 * rendering straight onto a <canvas> (jsbarcode for the three linear types,
 * the `qrcode` package for QR); nothing here calls the backend — the
 * backend only ever stores the barcode *value* and logs that it was
 * generated (see barcodeLabel.service.js's generateBarcodesForBatch).
 */
export default function BarcodeImage({
  value, barcodeType = 'code-128', height = 60, width = 160,
}) {
  const canvasRef = useRef(null);
  const isQr = barcodeType === 'qr';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!value || !canvas) return;

    if (isQr) {
      QRCode.toCanvas(canvas, value, { width: height, margin: 0 }).catch(() => {});
      return;
    }

    const format = resolveFormat(barcodeType, value);
    try {
      JsBarcode(canvas, value, {
        format, width: 1.6, height: Math.max(height - 20, 20), displayValue: true, fontSize: 11, margin: 2,
      });
    } catch {
      // A value that still fails CODE128 (e.g. empty after trimming) is the
      // only case left — leave the canvas blank rather than throw.
    }
  }, [value, barcodeType, isQr, height]);

  if (!value) {
    return <Typography variant="caption" sx={{ color: 'text.secondary' }}>No barcode value</Typography>;
  }

  return (
    <Box sx={{ display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        width={isQr ? height : width}
        height={height}
        style={{ width: isQr ? height : width, height, maxWidth: '100%' }}
      />
    </Box>
  );
}
