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
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import CardGiftcardOutlinedIcon from '@mui/icons-material/CardGiftcardOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';

import { useAppDispatch } from '../../app/hooks';
import { showToast } from '../../features/ui/uiSlice';
import StatCard from '../../components/common/StatCard';
import { formatCurrency, formatNumber } from '../../utils/format';

import SalesInvoiceTable from './components/SalesInvoiceTable';
import InvoiceDetailsCard from './components/InvoiceDetailsCard';
import InvoiceTermsAndNotes from './components/InvoiceTermsAndNotes';
import { useGetSalesInvoicesQuery, useSalesInvoiceStatusSummaryQuery } from '../../api/salesInvoiceApi';
import { toInvoiceRow, toInvoiceDetails, buildStatusStats } from './salesInvoiceDisplay';

const STATUS_META = {
  draft: { label: 'Draft Invoices', pageTitle: 'Draft', icon: EditNoteOutlinedIcon, iconColor: 'warning' },
  sent: { label: 'Sent Invoices', pageTitle: 'Sent', icon: SendOutlinedIcon, iconColor: 'info' },
  paid: { label: 'Paid Invoices', pageTitle: 'Paid', icon: CheckCircleOutlinedIcon, iconColor: 'success' },
  overdue: { label: 'Overdue Invoices', pageTitle: 'Overdue', icon: ErrorOutlineOutlinedIcon, iconColor: 'error' },
};

// The 3 "extra" stat tile icons/colors per status, in the same order as
// buildStatusStats()'s extra array (Total Amount / Average Invoice Value /
// Total Line Items — all real aggregates, see salesInvoiceDisplay.js).
const EXTRA_TILE_STYLE = {
  draft: [
    { icon: CardGiftcardOutlinedIcon, iconColor: 'success' },
    { icon: TrendingUpOutlinedIcon, iconColor: 'warning' },
    { icon: DescriptionOutlinedIcon, iconColor: '#8B5CF6' },
  ],
  sent: [
    { icon: CardGiftcardOutlinedIcon, iconColor: 'success' },
    { icon: TrendingUpOutlinedIcon, iconColor: 'warning' },
    { icon: DescriptionOutlinedIcon, iconColor: '#8B5CF6' },
  ],
  paid: [
    { icon: CardGiftcardOutlinedIcon, iconColor: 'success' },
    { icon: TrendingUpOutlinedIcon, iconColor: 'warning' },
    { icon: DescriptionOutlinedIcon, iconColor: '#8B5CF6' },
  ],
  overdue: [
    { icon: CardGiftcardOutlinedIcon, iconColor: 'success' },
    { icon: TrendingUpOutlinedIcon, iconColor: 'warning' },
    { icon: DescriptionOutlinedIcon, iconColor: '#8B5CF6' },
  ],
};

/**
 * Shared page for the Draft / Sent / Paid / Overdue cards on the Sales
 * Invoice landing grid — same list+details+terms layout as the "All
 * Invoices" overview page, scoped by `status`. Fully wired to the real
 * backend: the table's rows and the 4 stat tiles both come from actual
 * SalesInvoice rows (see backend/src/modules/sales-invoice's
 * getSalesInvoiceStatusSummary), so a status with zero invoices honestly
 * shows zeros/empty states rather than fabricated figures. The Paid tab in
 * particular will genuinely show zero until a "Record Payment" backend
 * action exists (see the SalesInvoice model comment in schema.prisma) —
 * nothing currently sets status 'paid', so that's the honest state, not a
 * bug. Overdue is live-derived from dueDate (see computeStatus in
 * salesInvoice.service.js), not a stored column.
 */
export default function SalesInvoiceStatusPage({ status, tab, onTabChange, onCreate, onView, onEdit }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const meta = STATUS_META[status];
  const extraStyle = EXTRA_TILE_STYLE[status];
  const [moreActionsAnchor, setMoreActionsAnchor] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [notes, setNotes] = useState('');

  const { data: invoices = [] } = useGetSalesInvoicesQuery({});
  const { data: statusSummaryData } = useSalesInvoiceStatusSummaryQuery(status);

  const rows = useMemo(() => invoices.map(toInvoiceRow), [invoices]);
  const statusRows = useMemo(() => rows.filter((r) => r.status === status), [rows, status]);
  const stats = useMemo(() => buildStatusStats(status, statusSummaryData), [status, statusSummaryData]);
  const invoiceById = useMemo(() => Object.fromEntries(invoices.map((i) => [i.id, i])), [invoices]);

  const effectiveSelectedId = (selectedId && invoiceById[selectedId] && rows.find((r) => r.id === selectedId)?.status === status ? selectedId : statusRows[0]?.id);
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

  const tiles = [
    { icon: meta.icon, iconColor: meta.iconColor, label: `Total ${meta.label}`, value: formatNumber(stats.count.value), caption: stats.count.caption },
    ...stats.extra.map((tile, i) => ({
      icon: extraStyle[i].icon,
      iconColor: extraStyle[i].iconColor,
      label: tile.label,
      value: tile.currency ? formatCurrency(tile.value, { decimals: true }) : formatNumber(tile.value),
      caption: tile.caption,
    })),
  ];

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'flex-start', lg: 'center' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Sales Invoice ({meta.pageTitle})</Typography>
          <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />} sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 12.5 } }}>
            <MuiLink component={RouterLink} to="/home" underline="hover" color="text.secondary">Home</MuiLink>
            <MuiLink component={RouterLink} to="/sales-invoice" underline="hover" color="text.secondary">Sales Invoice</MuiLink>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{meta.pageTitle}</Typography>
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

      <Grid container spacing={2}>
        {tiles.map((tile) => (
          <Grid key={tile.label} size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard icon={tile.icon} iconColor={tile.iconColor} iconShape="circle" label={tile.label} value={tile.value} caption={tile.caption} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} sx={{ alignItems: 'stretch' }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Box sx={{ height: { lg: 560 } }}>
            <SalesInvoiceTable
              invoices={rows}
              selectedId={effectiveSelectedId}
              onSelectInvoice={handleSelectInvoice}
              onRowAction={handleRowAction}
              onFilters={handleFilters}
              defaultTab={status}
              tab={tab}
              onTabChange={onTabChange}
              statusColumn={false}
              createdByColumn={status !== 'paid'}
              dueDateColumn
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Box sx={{ height: '100%', overflow: 'auto' }}>
            {invoiceDetails ? (
              <InvoiceDetailsCard invoice={invoiceDetails} title={`Invoice Details (${meta.pageTitle})`} showPaidFields={status === 'paid'} />
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary', p: 2 }}>
                No {meta.pageTitle.toLowerCase()} invoices yet.
              </Typography>
            )}
          </Box>
        </Grid>
      </Grid>

      <InvoiceTermsAndNotes notes={notes} onNotesChange={setNotes} />
    </Stack>
  );
}
