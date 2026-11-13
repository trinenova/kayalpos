/**
 * FIFO pricing for the cart. Each product has open purchase lots (oldest
 * first), each with its own selling price. A line's qty is priced across the
 * lots in order, and the line's `price` becomes the weighted average, so
 * qty x price is exactly what the server will bill (it splits the line per lot).
 * Qty beyond the lots is priced at the product's own price (same as the server).
 */
export function fifoBreakdown(lots, qty, fallbackPrice) {
  const parts = [];
  let left = qty;
  (lots || []).forEach((lot) => {
    if (left <= 0) return;
    const take = Math.min(left, lot.qtyRemaining);
    if (take <= 0) return;
    parts.push({ lotNo: lot.lotNo, qty: take, price: lot.sellingPrice, mrp: lot.mrp });
    left -= take;
  });
  if (left > 0) parts.push({ lotNo: null, qty: left, price: fallbackPrice, mrp: null });
  return parts;
}

export function fifoAveragePrice(lots, qty, fallbackPrice) {
  if (!(qty > 0)) return (lots?.[0]?.sellingPrice) ?? fallbackPrice;
  const parts = fifoBreakdown(lots, qty, fallbackPrice);
  const total = parts.reduce((sum, p) => sum + p.qty * p.price, 0);
  return total / qty;
}

/** Groups the lots API rows by productId (already oldest first). */
export function groupLotsByProduct(lots) {
  const map = new Map();
  (lots || []).forEach((lot) => {
    if (!map.has(lot.productId)) map.set(lot.productId, []);
    map.get(lot.productId).push(lot);
  });
  return map;
}
