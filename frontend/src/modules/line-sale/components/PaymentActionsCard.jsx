import { Stack, Button, Paper, Box } from '@mui/material';
import LocalPrintshopOutlinedIcon from '@mui/icons-material/LocalPrintshopOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EmailWhatsappButtons from '../../../components/common/EmailWhatsappButtons';

const keyHint = (label) => (
  <Box component="span" sx={{ ml: 1, px: 0.75, py: 0.1, borderRadius: 1, fontSize: 10.5, fontWeight: 700, bgcolor: 'rgba(255,255,255,0.22)' }}>{label}</Box>
);

// "Print Invoice" (F10) and "Print settings" are intentionally hidden.
/**
 * Right column of the payment step, under the amount-payable card: the final
 * "settle the sale" actions. The Email / WhatsApp buttons (shared component)
 * only render when enabled in Settings.
 */
export default function PaymentActionsCard({
  onPayAndPrint, onBack, disabled,
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 4, p: 2.5 }}>
      <Stack spacing={1.5}>
        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={disabled}
          startIcon={<LocalPrintshopOutlinedIcon />}
          onClick={onPayAndPrint}
          sx={{ py: 1.5, fontSize: 15, fontWeight: 800, borderRadius: 3 }}
        >
          Pay &amp; Print{keyHint('F9')}
        </Button>

        <EmailWhatsappButtons />

        <Button
          variant="text"
          size="small"
          startIcon={<ArrowBackIcon sx={{ fontSize: 14 }} />}
          onClick={onBack}
          sx={{ alignSelf: 'center', fontWeight: 700 }}
        >
          Back to cart
        </Button>
      </Stack>
    </Paper>
  );
}
