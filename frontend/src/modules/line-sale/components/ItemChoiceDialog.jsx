import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Chip, Divider,
} from '@mui/material';

import { formatCurrency } from '../../../utils/format';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—');

/**
 * Shown on Line Sale when the item being added is ambiguous:
 *   - several active products share the same name (different code / pack /
 *     qty on hand), and/or
 *   - the product has 2+ open FIFO purchase lots with different qty / MRP /
 *     selling price.
 * Each candidate product is listed with its stock and price; its open lots
 * (oldest first) are shown underneath. Pick a product to add it to the bill —
 * quantity is then billed oldest lot first, as the server does.
 *
 * `choice` = { name, pickedCode, candidates: [{ product, lots }] }
 */
export default function ItemChoiceDialog({ choice, onClose, onPick }) {
  const open = Boolean(choice);
  const candidates = choice?.candidates || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        Select item
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400 }}>
          {candidates.length > 1
            ? `${candidates.length} products named "${choice?.name}" — choose the one to add`
            : `"${choice?.name}" has more than one stock lot`}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {candidates.map(({ product, lots }, i) => {
          const out = false; // stock is not enforced — items can be sold at 0 stock
          return (
            <Box key={product.code} sx={{ mb: i === candidates.length - 1 ? 0 : 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }} noWrap>
                    {product.name}
                    {product.code === choice?.pickedCode && (
                      <Chip size="small" label="Selected" color="primary" variant="outlined" sx={{ ml: 1 }} />
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {product.code}
                    {product.shortId ? ` · ID ${product.shortId}` : ''}
                    {product.packSize ? ` · ${product.packSize}` : ''}
                    {` · ${formatCurrency(Number(product.salePrice))}`}
                    {` · ${product.availableQty} ${product.uom} in stock`}
                  </Typography>
                </Box>
                <Button
                  variant={product.code === choice?.pickedCode ? 'contained' : 'outlined'}
                  size="small"
                  disabled={out}
                  onClick={() => onPick(product.code)}
                  sx={{ minHeight: 36, flexShrink: 0 }}
                >
                  {out ? 'Out of stock' : 'Add'}
                </Button>
              </Box>

              {lots.length > 1 && (
                <Box sx={{ mt: 1, ml: 1, pl: 1.5, borderLeft: 2, borderColor: 'divider' }}>
                  <Typography variant="caption" color="text.secondary">
                    Stock lots — sold oldest first
                  </Typography>
                  <Box component="table" sx={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', mt: 0.5 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'rgba(0,0,0,0.6)' }}>
                        <th>Lot</th>
                        <th>Received</th>
                        <th style={{ textAlign: 'right' }}>Qty left</th>
                        <th style={{ textAlign: 'right' }}>MRP</th>
                        <th style={{ textAlign: 'right' }}>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lots.map((lot, idx) => (
                        <tr key={lot.id} style={{ fontWeight: idx === 0 ? 700 : 400 }}>
                          <td>{lot.lotNo}{idx === 0 ? ' (next)' : ''}</td>
                          <td>{fmtDate(lot.receivedAt)}</td>
                          <td style={{ textAlign: 'right' }}>{lot.qtyRemaining}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(lot.mrp)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(lot.sellingPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Box>
                </Box>
              )}
              {i < candidates.length - 1 && <Divider sx={{ mt: 2 }} />}
            </Box>
          );
        })}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
