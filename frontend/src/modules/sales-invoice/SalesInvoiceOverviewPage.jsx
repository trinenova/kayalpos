import { useMemo, useState } from 'react';
import {
  Stack, Box, Typography, Button, Menu, MenuItem, Grid, Breadcrumbs, Link as MuiLink,
} from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import AddIcon from '@mui/icons-material/Add';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';

import { useAppDispatch } from '../../app/hooks';
import { showToast } from '../../features/ui/uiSlice';

import SalesInvoiceSummaryCards from './components/SalesInvoiceSummaryCards';
import SalesInvoiceTable from './components/SalesInvoiceTable';
import InvoiceDetailsCard from './components/InvoiceDetailsCard';
import InvoiceTermsAndNotes from './components/InvoiceTermsAndNotes';
import { useGetSalesInvoicesQuery, useSalesInvoiceSummaryQuery } from '../../api/salesInvoiceApi';
import { toInvoiceRow, toInvoiceDetails, buildSummary } from './salesInvoiceDisplay';

/**
 * Sales Invoice list/detail page — summary tiles, the invoice table with a
 * detail panel for whichever row is selected, and a Terms & Conditions /
 * Notes strip below. Fully wired to the real backend (see
 * backend/src/modules/sales-invoice): every tile, row and detail field comes
 * from the actual SalesInvoice table merged with this tenant's Line Sale
 * (POS) bills (see salesInvoice.service.js's listSalesInvoices), so a tenant
 * with neither yet honestly shows zeros/empty states instead of this page's
 * old static mock data. "Record Payment" stays a coming-soon placeholder for
 * a real SalesInvoice row — there is no backend action yet that marks one
 * 'paid' (see salesInvoice.schema.js comment) — and is disabled outright for
 * a Line Sale bill, which is already settled.
 */
export default function SalesInvoiceOverviewPage({ tab, onTabChange, onCreate, onView, onEdit }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [moreActionsAnchor, setMoreActionsAnchor] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [notes, setNotes] = useState('');

  const { data: invoices = [], isLoading, isError } = useGetSalesInvoicesQuery({});
  const { data: summaryData } = useSalesInvoiceSummaryQuery();

  const rows = useMemo(() => invoices.map(toInvoiceRow), [invoices]);
  const summary = useMemo(() => buildSummary(summaryData), [summaryData]);
  const invoiceById = useMemo(() => Object.fromEntries(invoices.map((i) => [i.id, i])), [invoices]);

  const effectiveSelectedId = selectedId && invoiceById[selectedId] ? selectedId : invoices[0]?.id;
  const selectedInvoice = effectiveSelectedId ? invoiceById[effectiveSelectedId] : null;
  const invoiceDetails = selectedInvoice ? toInvoiceDetails(selectedInvoice) : null;

  const handleSelectInvoice = (row) => setSelectedId(row.id);
  const handleRowAction = (label, row) => {
    if (label === 'View') return onView ? onView(row.id) : navigate(`/sales-invoice/view/${row.id}`);
    if (label === 'Edit') return onEdit ? onEdit(row.id) : navigate(`/sales-invoice/edit/${row.id}`);
    dispatch(showToast(`${label} "${row.code}" is coming soon`, 'info'));
  };
  const handlePrintPreview = () => dispatch(showToast('Print / Preview is coming soon', 'info'));
  const handleRecordPayment = () => dispatch(showToast(`Record Payment for "${invoiceDetails?.code || ''}" is coming soon`, 'info'));
  const handleCreate = () => {
    if (onCreate) onCreate(); else navigate('/sales-invoice/create');
  };
  const handleFilters = () => dispatch(showToast('Filters are coming soon', 'info'));
  const handleMoreAction = (label) => {
    setMoreActionsAnchor(null);
    dispatch(showToast(`${label} is coming soon`, 'info'));
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'flex-start', lg: 'center' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Sales Invoice</Typography>
          <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />} sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 12.5 } }}>
            <MuiLink component={RouterLink} to="/home" underline="hover" color="text.secondary">Home</MuiLink>
            <MuiLink component={RouterLink} to="/sales-invoice" underline="hover" color="text.secondary">Sales Invoice</MuiLink>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Invoice List</Typography>
          </Breadcrumbs>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', width: { xs: '100%', lg: 'auto' } }}>
          <Button variant="outlined" color="inherit" startIcon={<PrintOutlinedIcon fontSize="small" />} onClick={handlePrintPreview}>
            Print / Preview
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<PaymentsOutlinedIcon fontSize="small" />}
            onClick={handleRecordPayment}
            disabled={!invoiceDetails || invoiceDetails.source === 'pos'}
          >
            Record Payment
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            endIcon={<ExpandMoreIcon />}
            onClick={(e) => setMoreActionsAnchor(e.currentTarget)}
          >
            More Actions
          </Button>
          <Menu anchorEl={moreActionsAnchor} open={Boolean(moreActionsAnchor)} onClose={() => setMoreActionsAnchor(null)}>
            <MenuItem onClick={() => handleMoreAction('Export Invoices')}>Export Invoices</MenuItem>
            <MenuItem onClick={() => handleMoreAction('Duplicate Invoice')}>Duplicate Invoice</MenuItem>
            <MenuItem onClick={() => handleMoreAction('Delete Invoice')}>Delete Invoice</MenuItem>
          </Menu>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
            New Sales Invoice
          </Button>
        </Stack>
      </Stack>

      <SalesInvoiceSummaryCards summary={summary} />

      <Grid container spacing={2} sx={{ alignItems: 'stretch' }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Box sx={{ height: { lg: 640 } }}>
            <SalesInvoiceTable
              invoices={rows}
              selectedId={effectiveSelectedId}
              onSelectInvoice={handleSelectInvoice}
              onRowAction={handleRowAction}
              onFilters={handleFilters}
              tab={tab}
              onTabChange={onTabChange}
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Box sx={{ height: { lg: 640 }, overflow: 'auto' }}>
            {isLoading ? (
              <Typography variant="body2" sx={{ color: 'text.secondary', p: 2 }}>Loading invoices…</Typography>
            ) : isError ? (
              <Typography variant="body2" color="error" sx={{ p: 2 }}>Failed to load invoices.</Typography>
            ) : invoiceDetails ? (
              <InvoiceDetailsCard invoice={invoiceDetails} showPaidFields={invoiceDetails.status === 'paid'} />
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary', p: 2 }}>
                No invoices yet — create one to get started.
              </Typography>
            )}
          </Box>
        </Grid>
      </Grid>

      <InvoiceTermsAndNotes notes={notes} onNotesChange={setNotes} />
    </Stack>
  );
}
