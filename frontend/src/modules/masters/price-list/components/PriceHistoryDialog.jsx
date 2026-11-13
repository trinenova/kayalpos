import {
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  Stack, Typography, Button, CircularProgress, Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';

import { formatCurrency } from '../../../../utils/format';
import { useGetPriceHistoryQuery } from '../../../../api/sellingPriceApi';

function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(value));
}

/**
 * Price List grid's Actions column — one "Price History" entry per past
 * "Update Price"/"Bulk Update" save for this product (see
 * backend/src/modules/selling-price's listPriceHistory), newest first.
 * `refetchOnMountOrArgChange` means re-opening this dialog (even for the
 * same product) always shows the latest history rather than a stale cached
 * list from before some other change.
 */
export default function PriceHistoryDialog({ open, product, onClose }) {
  const { data: history = [], isLoading, isFetching } = useGetPriceHistoryQuery(product?.productId, {
    skip: !open || !product,
    refetchOnMountOrArgChange: true,
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', pr: 1.5 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <HistoryOutlinedIcon fontSize="small" sx={{ color: 'primary.main' }} />
          <Stack>
            <Typography sx={{ fontWeight: 800, fontSize: 17 }}>Price History</Typography>
            {product && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {product.code} · {product.name}{product.packSize ? ` (${product.packSize})` : ''}
              </Typography>
            )}
          </Stack>
        </Stack>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {(isLoading || isFetching) && (
          <Stack sx={{ alignItems: 'center', py: 3 }}><CircularProgress size={24} /></Stack>
        )}
        {!isLoading && !isFetching && history.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>
            No price changes recorded yet.
          </Typography>
        )}
        {!isLoading && !isFetching && history.length > 0 && (
          <Stack spacing={1.5} divider={<Divider />}>
            {history.map((entry) => (
              <Stack key={entry.id} spacing={0.25}>
                <Typography sx={{ fontWeight: 700 }}>
                  {formatCurrency(entry.previousPrice, { decimals: true })} {'→'} {formatCurrency(entry.newPrice, { decimals: true })}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {formatDateTime(entry.changedAt)}{entry.changedBy ? ` · ${entry.changedBy}` : ''}
                </Typography>
                {entry.remarks && (
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>{entry.remarks}</Typography>
                )}
              </Stack>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="text" onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
