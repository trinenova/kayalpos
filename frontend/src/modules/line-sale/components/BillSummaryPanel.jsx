import {
  Paper, Stack, Box, Typography, Chip, TextField, IconButton, Divider, Button, InputAdornment,
} from '@mui/material';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import PercentOutlinedIcon from '@mui/icons-material/PercentOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

import { formatCurrency } from '../../../utils/format';

const money = (v) => formatCurrency(v, { decimals: true });

/**
 * Right-hand "Bill Summary" sidebar on the billing step — discount input,
 * sub total / discount / taxable value / GST (with CGST+SGST split) and the
 * dark "Amount Payable" bar, ending in the "Continue to Payment" button.
 * Replaces the discount fields + totals block that used to live inside
 * CartPanel, plus the standalone "Proceed to Payment" button below the grid.
 */
export default function BillSummaryPanel({
  billStatus, itemCount, qtyCount,
  discount, discountType, onDiscountChange, onDiscountTypeChange,
  totals, onProceed, disabled,
}) {
  // One GST block per distinct rate on the bill (each product has its own).
  const taxGroups = totals.taxGroups || [];
  const pct = (rate) => Number((rate * 100).toFixed(2));

  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Bill Summary</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {itemCount} {itemCount === 1 ? 'item' : 'items'} · {qtyCount} qty
          </Typography>
        </Box>
        <Chip label={billStatus} size="small" sx={{ fontWeight: 700 }} />
      </Stack>

      <Box>
        <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 0.5, color: 'text.secondary' }}>
          DISCOUNT
        </Typography>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mt: 0.75 }}>
          <IconButton
            onClick={() => onDiscountTypeChange('amount')}
            sx={{
              border: '1px solid', borderColor: discountType === 'amount' ? 'primary.main' : 'divider',
              borderRadius: 1.5,
              bgcolor: discountType === 'amount' ? 'primary.main' : 'transparent',
              color: discountType === 'amount' ? 'primary.contrastText' : 'text.secondary',
              '&:hover': { bgcolor: discountType === 'amount' ? 'primary.dark' : 'action.hover' },
            }}
          >
            <LocalOfferOutlinedIcon fontSize="small" />
          </IconButton>
          <IconButton
            onClick={() => onDiscountTypeChange('percent')}
            sx={{
              border: '1px solid', borderColor: discountType === 'percent' ? 'primary.main' : 'divider',
              borderRadius: 1.5,
              bgcolor: discountType === 'percent' ? 'primary.main' : 'transparent',
              color: discountType === 'percent' ? 'primary.contrastText' : 'text.secondary',
              '&:hover': { bgcolor: discountType === 'percent' ? 'primary.dark' : 'action.hover' },
            }}
          >
            <PercentOutlinedIcon fontSize="small" />
          </IconButton>
          <TextField
            size="small"
            type="number"
            fullWidth
            value={discount}
            onChange={(e) => onDiscountChange(Math.max(0, Number(e.target.value) || 0))}
            slotProps={{
              input: discountType === 'amount' ? { startAdornment: <InputAdornment position="start">₹</InputAdornment> }
                : { endAdornment: <InputAdornment position="end">%</InputAdornment> },
            }}
          />
        </Stack>
      </Box>

      <Stack spacing={1}>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Sub total</Typography>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{money(totals.subTotal)}</Typography>
        </Stack>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Discount</Typography>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{money(totals.discountAmount)}</Typography>
        </Stack>
        {taxGroups.length > 0 && (
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Taxable value</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{money(totals.taxable)}</Typography>
          </Stack>
        )}
        {taxGroups.map((g) => (
          <Stack key={g.rate} spacing={1}>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>GST {pct(g.rate)}%</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{money(g.tax)}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', pl: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>CGST {pct(g.rate) / 2}%</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{money(g.tax / 2)}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', pl: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>SGST {pct(g.rate) / 2}%</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{money(g.tax / 2)}</Typography>
            </Stack>
          </Stack>
        ))}
      </Stack>

      <Divider />

      <Stack
        direction="row"
        sx={{
          alignItems: 'center', justifyContent: 'space-between', borderRadius: 2.5, p: 2,
          bgcolor: '#4A6FA5', color: '#fff',
        }}
      >
        <Box>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>AMOUNT PAYABLE</Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>Inclusive of GST</Typography>
        </Box>
        <Typography sx={{ fontSize: 22, fontWeight: 800 }}>{money(totals.grandTotal)}</Typography>
      </Stack>

      <Button
        variant="contained"
        size="large"
        endIcon={<ArrowForwardIcon />}
        onClick={onProceed}
        disabled={disabled}
        fullWidth
      >
        Continue to Payment
      </Button>
      <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
        Next: payment, customer &amp; print
      </Typography>
    </Paper>
  );
}
