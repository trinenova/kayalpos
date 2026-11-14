import { TAX_RATE } from './saleConstants.js';

/**
 * Per-product GST. A Product's `taxCode` holds the name (or code) of a row in
 * the Tax Code master, whose `rate` is a percent (5 = 5%). Returns a function
 * product -> rate as a fraction (0.05), so every sale / held-bill line is taxed
 * at its own product's rate. A product with no tax code, or one that matches no
 * ACTIVE tax code, falls back to the flat default (TAX_RATE, 5%) — the previous
 * behaviour — so nothing breaks while the master data is being filled in.
 * Prices INCLUDE GST (it is extracted, not added); products without the GST
 * flag in the master get rate 0.
 */
export async function loadTaxRateResolver(client, tenantId) {
  const codes = await client.taxCode.findMany({
    where: { tenantId, status: 'ACTIVE' },
    select: { code: true, name: true, rate: true },
  });
  const byKey = new Map();
  codes.forEach((t) => {
    const rate = Number(t.rate) / 100;
    byKey.set(String(t.name).trim().toLowerCase(), rate);
    // The name wins if a code of another row happens to equal it.
    const codeKey = String(t.code).trim().toLowerCase();
    if (!byKey.has(codeKey)) byKey.set(codeKey, rate);
  });
  return (product) => {
    const key = String(product?.taxCode || '').trim().toLowerCase();
    // GST applies only to products flagged GST in the Product master; prices
    // are GST-inclusive, so a non-GST product carries no tax at all.
    if (!product?.isGst) return 0;
    return key && byKey.has(key) ? byKey.get(key) : TAX_RATE;
  };
}
