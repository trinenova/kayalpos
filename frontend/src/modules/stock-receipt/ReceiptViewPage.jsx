import {
  Stack, Box, Typography, Button, Grid, Breadcrumbs, Link as MuiLink,
} from '@mui/material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';

import StockReceiptDetailsCard from './components/StockReceiptDetailsCard';
import { useGetStockReceiptQuery } from '../../api/stockReceiptApi';
import { toReceiptDetails } from './stockReceiptDisplay';

/**
 * Read-only "View Receipt" body for StockReceiptTable's row menu — reuses
 * the exact same StockReceiptDetailsCard the list page already shows for
 * the selected row. Rendered by StockReceiptPage via props (`id`/`onBack`/
 * `onEdit`) as part of the single /stock-receipt page rather than its own
 * route. Fully wired to the real backend — every field here comes from the
 * actual StockReceipt row fetched by GET /api/stock-receipts/:id.
 */
export default function ReceiptViewPage({ id: propId, onBack, onEdit }) {
  const navigate = useNavigate();
  const { id: paramId } = useParams();
  const id = propId ?? paramId;
  const { data: row, isLoading, isError } = useGetStockReceiptQuery(id, { skip: !id });
  const receipt = row ? toReceiptDetails(row) : null;

  const handleBack = () => (onBack ? onBack() : navigate('/stock-receipt'));

  if (isLoading) {
    return (
      <Stack spacing={2}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Loading receipt…</Typography>
      </Stack>
    );
  }

  if (isError || !receipt) {
    return (
      <Stack spacing={2}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Receipt not found</Typography>
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon fontSize="small" />} onClick={handleBack} sx={{ width: 'fit-content' }}>
          Back to Stock Receipt List
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>{receipt.code}</Typography>
          <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />} sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 12.5 } }}>
            <MuiLink component={RouterLink} to="/home" underline="hover" color="text.secondary">Home</MuiLink>
            <MuiLink component={RouterLink} to="/stock-receipt" underline="hover" color="text.secondary">Stock Receipt</MuiLink>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{receipt.code}</Typography>
          </Breadcrumbs>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" color="inherit" startIcon={<ArrowBackOutlinedIcon fontSize="small" />} onClick={handleBack}>
            Back to Stock Receipt List
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ alignItems: 'stretch' }}>
        <Grid size={12}>
          <StockReceiptDetailsCard receipt={receipt} />
        </Grid>
      </Grid>
    </Stack>
  );
}
