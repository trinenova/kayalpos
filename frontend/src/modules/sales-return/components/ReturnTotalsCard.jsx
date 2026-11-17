import {
  Paper, Stack, Typography, Divider, TextField, MenuItem, RadioGroup, FormControlLabel, Radio,
} from '@mui/material';
import { formatCurrency } from '../../../utils/format';

/**
 * Totals + settlement, in one card. Replaces the old separate
 * Refund/Adjustment card (per the owner's request to drop it): in Return
 * mode this card now also carries the Refund Mode radio and the Refund To
 * select that card used to own, so "how much" and "how it's settled" sit
 * together. In Exchange mode it shows both sides' totals (what's coming
 * back vs what's going out) plus a settlement method for whichever way
 * `balanceAmount` leans — the same balance the backend computes and
 * requires a settlement mode for whenever it isn't exactly zero.
 */
export default function ReturnTotalsCard({
  returnType,
  totals,
  refundMode, onRefundModeChange, refundTo, onRefundToChange, refundPaymentMethods,
  exchangeTotals, balanceAmount, settlementMode, onSettlementModeChange, settlementMethods,
}) {
  if (returnType === 'exchange') {
    const balance = Number(balanceAmount) || 0;
    const isEven = Math.abs(balance) < 0.005;
    const customerOwes = balance > 0;

    return (
      <Paper variant="outlined" sx={{ borderRadius: 3, p: 2, height: '100%', bgcolor: 'background.default' }}>
        <Stack spacing={1} sx={{ height: '100%', justifyContent: 'center' }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Returned Items Value</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatCurrency(totals.grandTotal, { decimals: true })}</Typography>
          </Stack>
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Exchange Items Value</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatCurrency(exchangeTotals.grandTotal, { decimals: true })}</Typography>
          </Stack>
          <Divider />
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {isEven ? 'Balance' : customerOwes ? 'Customer Pays' : 'Refund to Customer'}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: isEven ? 'text.secondary' : customerOwes ? 'error.main' : 'success.main' }}>
              {formatCurrency(Math.abs(balance), { decimals: true })}
            </Typography>
          </Stack>

          {!isEven && (
            <TextField
              select
              size="small"
              label={customerOwes ? 'Collect Via' : 'Refund Via'}
              value={settlementMode}
              onChange={(e) => onSettlementModeChange(e.target.value)}
              fullWidth
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            >
              <MenuItem value="">
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Select Payment Method</Typography>
              </MenuItem>
              {settlementMethods.map((m) => (
                <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
              ))}
            </TextField>
          )}
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, p: 2, height: '100%', bgcolor: 'background.default' }}>
      <Stack spacing={1} sx={{ height: '100%', justifyContent: 'center' }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Sub Total</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatCurrency(totals.subTotal, { decimals: true })}</Typography>
        </Stack>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Discount</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatCurrency(totals.discountAmount, { decimals: true })}</Typography>
        </Stack>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Tax</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatCurrency(totals.tax, { decimals: true })}</Typography>
        </Stack>
        <Divider />
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Grand Total</Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main' }}>
            {formatCurrency(totals.grandTotal, { decimals: true })}
          </Typography>
        </Stack>

        <Divider />

        <RadioGroup row value={refundMode} onChange={(e) => onRefundModeChange(e.target.value)}>
          <FormControlLabel value="refund" control={<Radio size="small" />} label={<Typography variant="body2">Refund</Typography>} />
          <FormControlLabel value="credit-note" control={<Radio size="small" />} label={<Typography variant="body2">Credit Note</Typography>} />
        </RadioGroup>

        <TextField
          select
          size="small"
          label="Refund To"
          value={refundTo}
          onChange={(e) => onRefundToChange(e.target.value)}
          fullWidth
          disabled={refundMode !== 'refund'}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Select Payment Method</Typography>
          </MenuItem>
          {refundPaymentMethods.map((m) => (
            <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
          ))}
        </TextField>
      </Stack>
    </Paper>
  );
}
