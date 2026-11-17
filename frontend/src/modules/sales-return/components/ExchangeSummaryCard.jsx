import { Stack, Typography, Chip } from '@mui/material';
import InfoCard from '../../../components/common/InfoCard';
import { formatCurrency } from '../../../utils/format';

/**
 * Stands in for RefundSummaryCard when `returnType === 'exchange'` — same
 * card shell, but the numbers that matter in an exchange aren't "how much
 * refund is left", they're "what did the customer hand back" vs "what are
 * they taking" and which way the difference goes. `balanceAmount` is
 * `exchangeGrandTotal - returnGrandTotal` (positive = customer owes more,
 * negative = store owes the customer, zero = even swap) — the exact same
 * number the backend recomputes and validates a settlement method against
 * in salesReturn.service.js's createSalesReturn, so this card can never
 * show a balance the backend would actually reject as unsettled.
 */
export default function ExchangeSummaryCard({ returnedValue, exchangeValue, balanceAmount, settlementModeLabel }) {
  const balance = Number(balanceAmount) || 0;
  const isEven = Math.abs(balance) < 0.005;
  const customerOwes = balance > 0;

  const rows = [
    { label: 'Items Returned (Value)', value: returnedValue },
    { label: 'Items Taken (Value)', value: exchangeValue },
  ];

  return (
    <InfoCard title="Exchange Summary" dense sx={{ height: '100%' }}>
      <Stack spacing={1.25}>
        {rows.map((row) => (
          <Stack key={row.label} direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>{row.label}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {formatCurrency(row.value, { decimals: true })}
            </Typography>
          </Stack>
        ))}

        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', pt: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {isEven ? 'Balance' : customerOwes ? 'Customer Pays' : 'Refund to Customer'}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 800, color: isEven ? 'text.secondary' : customerOwes ? 'error.main' : 'success.main' }}>
            {formatCurrency(Math.abs(balance), { decimals: true })}
          </Typography>
        </Stack>

        {!isEven && settlementModeLabel && (
          <Chip
            size="small"
            label={`via ${settlementModeLabel}`}
            sx={{ alignSelf: 'flex-start', fontWeight: 600 }}
          />
        )}
      </Stack>
    </InfoCard>
  );
}
