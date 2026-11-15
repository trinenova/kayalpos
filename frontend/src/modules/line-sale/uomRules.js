/**
 * Units of measure for the Line Sale grid.
 *
 * A line is sold in exactly the UOM set on the product in Masters > Product
 * (PCS, Kg, Nos, ...) — no other unit is offered. Price is per that UOM and
 * decimal quantities are allowed (up to 3 places).
 *
 * KEEP IN SYNC with backend/src/modules/sale/uomRules.js.
 */
const norm = (v) => String(v ?? '').trim().toLowerCase();

export const round3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;

/** { base, units: [{ uom, factor }] } — a single unit: the product's master UOM. */
export function unitsForProduct(product) {
  const base = String(product?.uom ?? '').trim() || 'Nos';
  return { base, units: [{ uom: base, factor: 1 }] };
}

export function unitOf(info, uom) {
  return info.units.find((u) => norm(u.uom) === norm(uom)) || info.units[0];
}

/** +/- stepper size. */
export const stepFor = () => 1;

/** Smallest sellable quantity. */
export const minQtyFor = () => 0.001;

/** Clamps a typed quantity to at least 0.001 and at most 3 decimal places. */
export function normalizeQty(unit, qty) {
  const n = Number(qty);
  return Number.isFinite(n) ? Math.max(minQtyFor(unit), round3(n)) : minQtyFor(unit);
}
