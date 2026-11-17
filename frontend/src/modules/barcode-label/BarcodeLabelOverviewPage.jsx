import { useMemo, useState } from 'react';
import {
  Stack, Box, Typography, Button, Menu, MenuItem, Grid, Breadcrumbs, Link as MuiLink,
} from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import AddIcon from '@mui/icons-material/Add';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';

import { useAppDispatch } from '../../app/hooks';
import { showToast } from '../../features/ui/uiSlice';

import BarcodeLabelSummaryCards from './components/BarcodeLabelSummaryCards';
import BarcodeLabelTable from './components/BarcodeLabelTable';
import LabelDetailsCard from './components/LabelDetailsCard';
import LabelTermsAndNotes from './components/LabelTermsAndNotes';
import BarcodePrintDialog from './components/BarcodePrintDialog';
import {
  useGetBarcodeLabelBatchesQuery, useBarcodeLabelSummaryQuery, useGenerateBarcodeLabelMutation,
} from '../../api/barcodeLabelApi';
import { toBatchRow, toBatchDetails, buildSummary } from './barcodeLabelDisplay';

/**
 * Barcode & Label list/detail page — summary tiles, the batch table with a
 * detail panel for whichever row is selected, and a Terms & Conditions /
 * Notes strip below. Fully wired to the real backend (see
 * backend/src/modules/barcode-label): every tile, row and detail field
 * comes from the actual BarcodeLabelBatch table, so a tenant with no batches
 * yet honestly shows zeros/empty states instead of this page's old static
 * mock data.
 */
export default function BarcodeLabelOverviewPage({ tab, onTabChange, onCreate, onView, onEdit }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [moreActionsAnchor, setMoreActionsAnchor] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [notes, setNotes] = useState('');
  const [printOpen, setPrintOpen] = useState(false);

  const { data: batches = [], isLoading, isError } = useGetBarcodeLabelBatchesQuery({});
  const { data: summaryData } = useBarcodeLabelSummaryQuery();
  const [generateBarcodes, { isLoading: isGenerating }] = useGenerateBarcodeLabelMutation();

  const rows = useMemo(() => batches.map(toBatchRow), [batches]);
  const summary = useMemo(() => buildSummary(summaryData), [summaryData]);
  const batchById = useMemo(() => Object.fromEntries(batches.map((b) => [b.id, b])), [batches]);

  const effectiveSelectedId = selectedId && batchById[selectedId] ? selectedId : batches[0]?.id;
  const selectedBatch = effectiveSelectedId ? batchById[effectiveSelectedId] : null;
  const batchDetails = selectedBatch ? toBatchDetails(selectedBatch) : null;

  const handleSelectBatch = (row) => setSelectedId(row.id);
  const handleRowAction = (label, row) => {
    if (label === 'View') return onView ? onView(row.id) : navigate(`/barcode-label/view/${row.id}`);
    if (label === 'Edit') return onEdit ? onEdit(row.id) : navigate(`/barcode-label/edit/${row.id}`);
    return dispatch(showToast(`${label} "${row.code}" is coming soon`, 'info'));
  };
  const handlePrintPreview = () => {
    if (!selectedBatch) return dispatch(showToast('Select a batch to preview first', 'info'));
    setPrintOpen(true);
  };
  const handleGenerate = async () => {
    if (!selectedBatch) return;
    try {
      const result = await generateBarcodes(selectedBatch.id).unwrap();
      dispatch(showToast(`Barcodes generated for ${result.batch.code} and saved to history`, 'success'));
    } catch (err) {
      dispatch(showToast(err?.data?.message || 'Failed to generate barcodes', 'error'));
    }
  };
  const handleCreate = () => {
    if (onCreate) onCreate(); else navigate('/barcode-label/create');
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
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Barcode &amp; Label</Typography>
          <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />} sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 12.5 } }}>
            <MuiLink component={RouterLink} to="/home" underline="hover" color="text.secondary">Home</MuiLink>
            <MuiLink component={RouterLink} to="/barcode-label" underline="hover" color="text.secondary">Barcode &amp; Label</MuiLink>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Batch List</Typography>
          </Breadcrumbs>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', width: { xs: '100%', lg: 'auto' } }}>
          <Button variant="outlined" color="inherit" startIcon={<PrintOutlinedIcon fontSize="small" />} onClick={handlePrintPreview}>
            Print / Preview
          </Button>
          <Button variant="outlined" color="inherit" startIcon={<HistoryOutlinedIcon fontSize="small" />} onClick={() => onTabChange && onTabChange('history')}>
            Barcode History
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
            <MenuItem onClick={() => handleMoreAction('Export Batches')}>Export Batches</MenuItem>
            <MenuItem onClick={() => handleMoreAction('Duplicate Batch')}>Duplicate Batch</MenuItem>
            <MenuItem onClick={() => handleMoreAction('Delete Batch')}>Delete Batch</MenuItem>
          </Menu>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
            New Barcode &amp; Label
          </Button>
        </Stack>
      </Stack>

      <BarcodeLabelSummaryCards summary={summary} />

      <Grid container spacing={2} sx={{ alignItems: 'stretch' }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Box sx={{ height: { lg: 640 } }}>
            <BarcodeLabelTable
              batches={rows}
              selectedId={effectiveSelectedId}
              onSelectBatch={handleSelectBatch}
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
              <Typography variant="body2" sx={{ color: 'text.secondary', p: 2 }}>Loading batches…</Typography>
            ) : isError ? (
              <Typography variant="body2" color="error" sx={{ p: 2 }}>Failed to load batches.</Typography>
            ) : batchDetails ? (
              <LabelDetailsCard batch={batchDetails} showPrintedFields={batchDetails.status === 'printed'} />
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary', p: 2 }}>
                No batches yet — create one to get started.
              </Typography>
            )}
          </Box>
        </Grid>
      </Grid>

      <LabelTermsAndNotes notes={notes} onNotesChange={setNotes} />

      <BarcodePrintDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        batch={selectedBatch}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
      />
    </Stack>
  );
}
