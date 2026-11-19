import { Paper, Stack, Box, Typography, Divider } from '@mui/material';
import { useFormContext, useWatch } from 'react-hook-form';

function toNumber(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

// formatNumber() (Intl-based, no fixed decimals) would print "0" for an
// empty total instead of "0.00" — the reference screenshot shows two
// decimal places on all three figures, so format directly here.
function formatCount(value) {
  return value.toFixed(2);
}

function TotalRow({ label, value, strong }) {
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
      <Typography variant="body2" sx={{ color: strong ? 'inherit' : 'text.secondary', fontWeight: strong ? 800 : 500 }}>
        {label}
      </Typography>
      <Typography variant={strong ? 'subtitle1' : 'body2'} sx={{ fontWeight: 800, color: strong ? 'primary.main' : 'text.primary' }}>
        {value}
      </Typography>
    </Stack>
  );
}

/**
 * Summary panel on the Create Barcode & Label form — Total Items / Total
 * Labels / Total Labels to Print, matching the reference. Unlike
 * Quotation/Order/Invoice's currency totals, this counts only the rows
 * whose checkbox is checked, so with every row unselected (the form's
 * default state) all three figures read 0.00, exactly as in the reference
 * screenshot.
 */
export default function LabelPrintSummaryCard() {
  const { control } = useFormContext();
  const items = useWatch({ control, name: 'items' });

  // Blank rows (no Item Code yet) don't count, so an untouched form reads 0.
  const selectedRows = items.filter((row) => row.selected && row.itemCode?.trim());
  const totalItems = selectedRows.length;
  const totalLabels = selectedRows.reduce((sum, row) => sum + toNumber(row.printQty), 0);
  const totalLabelsToPrint = totalLabels;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 2.5 }, height: '100%' }}>
      <Stack spacing={1.25}>
        <TotalRow label="Total Items" value={formatCount(totalItems)} />
        <TotalRow label="Total Labels" value={formatCount(totalLabels)} />
        <Divider sx={{ my: 0.5 }} />
        <Box sx={{ bgcolor: 'rgba(37,99,235,0.08)', borderRadius: 2, px: 1.5, py: 1 }}>
          <TotalRow label="Total Labels to Print" value={formatCount(totalLabelsToPrint)} strong />
        </Box>
      </Stack>
    </Paper>
  );
}
