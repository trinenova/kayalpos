import { useState } from 'react';
import {
  Stack, Box, Typography, Button, Grid, Breadcrumbs, Link as MuiLink,
} from '@mui/material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';

import InvoiceDetailsCard from './components/InvoiceDetailsCard';
import InvoiceTermsAndNotes from './components/InvoiceTermsAndNotes';
import { useGetSalesInvoiceQuery } from '../../api/salesInvoiceApi';
import { toInvoiceDetails } from './salesInvoiceDisplay';

/**
 * Read-only "View Invoice" body for SalesInvoiceTable's row menu — reuses
 * the exact same InvoiceDetailsCard/InvoiceTermsAndNotes cards the
 * Overview/Status pages already show for the selected row. Rendered by
 * SalesInvoicePage via props (`id`/`onBack`/`onEdit`) as part of the single
 * /sales-invoice page rather than its own route. Fully wired to the real
 * backend — every field here comes from the actual SalesInvoice row (or, for
 * a Line Sale bill shown here, its Linesales row) fetched by
 * GET /api/sales-invoices/:id. A Line Sale bill (invoice.source === 'pos')
 * has no "Edit Invoice" action — it's a settled POS transaction, not an
 * editable Sales Invoice document.
 */
export default function InvoiceViewPage({ id: propId, onBack, onEdit }) {
  const navigate = useNavigate();
  const { id: paramId } = useParams();
  const id = propId ?? paramId;
  const { data: row, isLoading, isError } = useGetSalesInvoiceQuery(id, { skip: !id });
  const invoice = row ? toInvoiceDetails(row) : null;
  const [notes, setNotes] = useState('');

  const handleBack = () => (onBack ? onBack() : navigate('/sales-invoice'));
  const handleEdit = () => (onEdit ? onEdit() : navigate(`/sales-invoice/edit/${id}`));

  if (isLoading) {
    return (
      <Stack spacing={2}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Loading invoice…</Typography>
      </Stack>
    );
  }

  if (isError || !invoice) {
    return (
      <Stack spacing={2}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Invoice not found</Typography>
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon fontSize="small" />} onClick={handleBack} sx={{ width: 'fit-content' }}>
          Back to Sales Invoice List
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>{invoice.code}</Typography>
          <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />} sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 12.5 } }}>
            <MuiLink component={RouterLink} to="/home" underline="hover" color="text.secondary">Home</MuiLink>
            <MuiLink component={RouterLink} to="/sales-invoice" underline="hover" color="text.secondary">Sales Invoice</MuiLink>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{invoice.code}</Typography>
          </Breadcrumbs>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" color="inherit" startIcon={<ArrowBackOutlinedIcon fontSize="small" />} onClick={handleBack}>
            Back to Sales Invoice List
          </Button>
          {invoice.source !== 'pos' && (
            <Button variant="contained" onClick={handleEdit}>
              Edit Invoice
            </Button>
          )}
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ alignItems: 'stretch' }}>
        <Grid size={12}>
          <InvoiceDetailsCard invoice={invoice} showPaidFields={invoice.status === 'paid'} />
        </Grid>
      </Grid>

      <InvoiceTermsAndNotes notes={notes} onNotesChange={setNotes} />
    </Stack>
  );
}
