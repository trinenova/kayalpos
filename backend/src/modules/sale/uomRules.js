import { ApiError } from '../../middleware/errorHandler.js';

/**
 * Units of measure for Line Sale — see frontend/src/modules/line-sale/uomRules.js
 * (KEEP IN SYNC). A line is sold in exactly one UOM: the UOM of the barcode it
 * was scanned with (Masters > Product > Barcodes tab) when that barcode has
 * one, otherwise the product's master UOM. Any other unit is rejected. Decimal
 * quantities are allowed for every UOM.
 */
const norm = (v) => String(v ?? '').trim().toLowerCase();
const round3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;

export function lineUomOf(product, barcodeRow) {
  return String(barcodeRow?.uom ?? '').trim() || String(product?.uom ?? '').trim() || 'Nos';
}

/**
 * Validates one cart line (qty typed in `uom`) and returns { qty, uom }.
 * `barcodeRow` is the ProductBarcode the line was scanned with, if any.
 * Throws a 400 for a unit the line cannot be sold in or a non-positive quantity.
 */
export function resolveLineQty(product, qty, uom, barcodeRow = null) {
  const entered = Number(qty);
  if (!Number.isFinite(entered) || entered <= 0) {
    throw new ApiError(400, `Quantity for ${product.name} must be greater than 0`);
  }
  const label = lineUomOf(product, barcodeRow);
  const allowed = [label, product.uom].filter(Boolean);
  if (uom && !allowed.some((u) => norm(u) === norm(uom))) {
    throw new ApiError(400, `${product.name} can only be sold in ${label}`);
  }
  const base = round3(entered);
  if (base <= 0) throw new ApiError(400, `Quantity for ${product.name} is too small`);
  return { qty: base, uom: label };
}
