import { useState } from 'react';
import {
  Stack, Box, Typography, Button, Grid, Breadcrumbs, Link as MuiLink,
} from '@mui/material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';

import { useAppDispatch } from '../../app/hooks';
import { showToast } from '../../features/ui/uiSlice';
import LabelDetailsCard from './components/LabelDetailsCard';
import LabelTermsAndNotes from './components/LabelTermsAndNotes';
import BarcodePrintDialog from './components/BarcodePrintDialog';
import { useGetBarcodeLabelBatchQuery, useGenerateBarcodeLabelMutation } from '../../api/barcodeLabelApi';
import { toBatchDetails } from './barcodeLabelDisplay';

/**
 * Read-only "View Batch" body for BarcodeLabelTable's row menu — reuses the
 * exact same LabelDetailsCard/LabelTermsAndNotes cards the Overview/Status
 * pages already show for the selected row. Rendered by BarcodeLabelPage via
 * props (`id`/`onBack`/`onEdit`) as part of the single /barcode-label page
 * rather than its own route. Fully wired to the real backend — every field
 * here comes from the actual BarcodeLabelBatch row fetched by GET
 * /api/barcode-labels/:id.
 */
export default function BarcodeLabelViewPage({ id: propId, onBack, onEdit }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { id: paramId } = useParams();
  const id = propId ?? paramId;
  const { data: row, isLoading, isError } = useGetBarcodeLabelBatchQuery(id, { skip: !id });
  const batch = row ? toBatchDetails(row) : null;
  const [notes, setNotes] = useState('');
  const [printOpen, setPrintOpen] = useState(false);
  const [generateBarcodes, { isLoading: isGenerating }] = useGenerateBarcodeLabelMutation();

  const handleBack = () => (onBack ? onBack() : navigate('/barcode-label'));
  const handleEdit = () => (onEdit ? onEdit() : navigate(`/barcode-label/edit/${id}`));
  const handleGenerate = async () => {
    if (!row) return;
    try {
      const result = await generateBarcodes(row.id).unwrap();
      dispatch(showToast(`Barcodes generated for ${result.batch.code} and saved to history`, 'success'));
    } catch (err) {
      dispatch(showToast(err?.data?.message || 'Failed to generate barcodes', 'error'));
    }
  };

  if (isLoading) {
    return (
      <Stack spacing={2}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Loading batch…</Typography>
      </Stack>
    );
  }

  if (isError || !batch) {
    return (
      <Stack spacing={2}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Batch not found</Typography>
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon fontSize="small" />} onClick={handleBack} sx={{ width: 'fit-content' }}>
          Back to Barcode &amp; Label List
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>{batch.code}</Typography>
          <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />} sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 12.5 } }}>
            <MuiLink component={RouterLink} to="/home" underline="hover" color="text.secondary">Home</MuiLink>
            <MuiLink component={RouterLink} to="/barcode-label" underline="hover" color="text.secondary">Barcode &amp; Label</MuiLink>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{batch.code}</Typography>
          </Breadcrumbs>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" color="inherit" startIcon={<ArrowBackOutlinedIcon fontSize="small" />} onClick={handleBack}>
            Back to Barcode &amp; Label List
          </Button>
          <Button variant="outlined" color="inherit" startIcon={<PrintOutlinedIcon fontSize="small" />} onClick={() => setPrintOpen(true)}>
            Print / Preview
          </Button>
          <Button variant="contained" onClick={handleEdit}>
            Edit Batch
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ alignItems: 'stretch' }}>
        <Grid size={12}>
          <LabelDetailsCard batch={batch} showPrintedFields={batch.status === 'printed'} />
        </Grid>
      </Grid>

      <LabelTermsAndNotes notes={notes} onNotesChange={setNotes} />

      <BarcodePrintDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        batch={row}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
      />
    </Stack>
  );
}
