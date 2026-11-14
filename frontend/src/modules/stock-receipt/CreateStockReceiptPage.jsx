import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Stack, Box, Typography, Button, Menu, MenuItem, Grid, Breadcrumbs, Link as MuiLink,
  Paper, TextField, IconButton, InputAdornment, Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import AddIcon from '@mui/icons-material/Add';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';

import { useAppDispatch } from '../../app/hooks';
import { showToast } from '../../features/ui/uiSlice';
import FormTextField from '../../components/form/FormTextField';
import FormDatePicker from '../../components/form/FormDatePicker';
import FormSelect from '../../components/form/FormSelect';
import { useGetSuppliersQuery } from '../../api/supplierApi';
import { useGetOutletsQuery } from '../../api/outletApi';
import { useGetProductsQuery } from '../../api/productApi';
import {
  useGetStockReceiptQuery, useNextStockReceiptCodeQuery,
  useCreateStockReceiptMutation, useUpdateStockReceiptMutation,
} from '../../api/stockReceiptApi';

import ReceiptItemsTable from './components/ReceiptItemsTable';
import ReceiptSummaryTotals from './components/ReceiptSummaryTotals';
import {
  createStockReceiptSchema, createStockReceiptDefaultValues, emptyItemRow, isBlankItemRow,
  PURCHASE_TYPE_OPTIONS, COST_CENTER_OPTIONS,
} from './createStockReceiptSchema';
import { receiptToFormValues, formValuesToPayload } from './stockReceiptDisplay';

const DEFAULT_TERMS = [
  'Goods once received will not be taken back.',
  'Please verify items, quantity & quality before acceptance.',
  'Any dispute should be reported within 7 days.',
  'This is not a sale transaction.',
];

/**
 * "New Stock Receipt" screen, also doubling as the Edit Receipt form when
 * StockReceiptPage renders it with an `id` prop — everything (list, create,
 * edit, view) lives on the one /stock-receipt page. Fully wired to the real
 * backend (see backend/src/modules/stock-receipt): Supplier and From Outlet/
 * HO come from the real Supplier/Outlet tables (see
 * useGetSuppliersQuery/useGetOutletsQuery), the Receipt No. is a live
 * preview of the next real code, and both "Save as Draft" and "Save & Send"
 * actually create/update a StockReceipt row with the same validations
 * enforced again server-side. "Save & Send" saves with status 'received' —
 * unlike Stock Transfer's in-transit dispatch step, receiving is the
 * terminal step of the goods-movement chain, so sending a receipt means the
 * goods have already been counted in and accepted.
 *
 * The Item Code cell is a searchable select against the real Product master
 * (see ItemCodeAutocomplete), which autofills Item Name/HSN/UoM when a
 * product is picked. Unlike Stock Indent/Stock Transfer's item grids,
 * Ordered Qty/Received Qty/Unit Cost/Discount/Tax are NOT looked up from the
 * Product master, though — they're the real figures the user types straight
 * off the supplier's invoice/GRN, so there's no `productByCode` prop to wire
 * up for those.
 *
 * Attachment stays a local-only file picker (there's no upload endpoint
 * yet), same as the reference design.
 */
export default function CreateStockReceiptPage({ id: propId, onBack }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { id: paramId } = useParams();
  const id = propId ?? paramId;
  const isEditMode = Boolean(id);
  const [moreActionsAnchor, setMoreActionsAnchor] = useState(null);
  const [attachmentName, setAttachmentName] = useState('');

  const { data: existingReceipt, isLoading: isLoadingReceipt } = useGetStockReceiptQuery(id, { skip: !isEditMode });
  const { data: nextCode } = useNextStockReceiptCodeQuery(undefined, { skip: isEditMode });
  const { data: suppliers = [] } = useGetSuppliersQuery({});
  const { data: outlets = [] } = useGetOutletsQuery({});
  const { data: products = [] } = useGetProductsQuery({});
  const [createReceipt, { isLoading: isCreating }] = useCreateStockReceiptMutation();
  const [updateReceipt, { isLoading: isUpdating }] = useUpdateStockReceiptMutation();
  const isSaving = isCreating || isUpdating;

  const receiptCode = isEditMode ? existingReceipt?.code : nextCode;

  // Real Supplier/Outlet options — the old mock version hardcoded both as
  // fixed lists of specific supplier/outlet names.
  const supplierOptions = useMemo(() => [
    { value: '', label: 'Select Supplier', disabled: true },
    ...suppliers.map((s) => ({ value: s.id, label: s.name })),
  ], [suppliers]);
  const outletOptions = useMemo(() => [
    { value: '', label: 'Select From Outlet / HO', disabled: true },
    ...outlets.map((o) => ({ value: o.id, label: o.name })),
  ], [outlets]);

  const methods = useForm({
    resolver: zodResolver(createStockReceiptSchema),
    defaultValues: createStockReceiptDefaultValues,
    mode: 'onTouched',
  });
  const { handleSubmit, reset } = methods;

  // The edit-mode fetch is async, so the form can't be seeded via useForm's
  // defaultValues (that only runs once, before the data exists) — reset()
  // re-seeds every field once the real receipt row arrives.
  useEffect(() => {
    if (isEditMode && existingReceipt) {
      reset(receiptToFormValues(existingReceipt, emptyItemRow));
    }
  }, [isEditMode, existingReceipt, reset]);

  const handleBack = () => {
    if (onBack) return onBack();
    if (isEditMode) return navigate(`/stock-receipt/view/${id}`);
    navigate('/stock-receipt');
  };

  const handlePrintPreview = () => dispatch(showToast('Print / Preview is coming soon', 'info'));
  const handleAddSupplier = () => dispatch(showToast('Supplier picker is coming soon', 'info'));
  const handleAddFromOutlet = () => dispatch(showToast('Outlet / HO picker is coming soon', 'info'));
  const handleAddCostCenter = () => dispatch(showToast('Cost Center picker is coming soon', 'info'));
  const handleAddItemRow = () => dispatch(showToast('Item picker is coming soon', 'info'));
  const handleAttachmentChange = (e) => setAttachmentName(e.target.files?.[0]?.name || '');
  const handleMoreAction = (label) => {
    setMoreActionsAnchor(null);
    dispatch(showToast(`${label} is coming soon`, 'info'));
  };

  const onSaveAsDraft = handleSubmit(async (values) => {
    try {
      const payload = formValuesToPayload(values, { status: 'draft', isBlankItemRow });
      if (isEditMode) {
        await updateReceipt({ id, ...payload }).unwrap();
        dispatch(showToast(`Receipt ${receiptCode} updated successfully`, 'success'));
      } else {
        const created = await createReceipt(payload).unwrap();
        dispatch(showToast(`Receipt ${created.code} saved as draft`, 'success'));
      }
      handleBack();
    } catch (err) {
      dispatch(showToast(err?.data?.message || 'Failed to save the receipt', 'error'));
    }
  });

  const onSaveAndSend = handleSubmit(async (values) => {
    try {
      const payload = formValuesToPayload(values, { status: 'received', isBlankItemRow });
      if (isEditMode) {
        await updateReceipt({ id, ...payload }).unwrap();
        dispatch(showToast(`Receipt ${receiptCode} updated successfully`, 'success'));
      } else {
        const created = await createReceipt(payload).unwrap();
        dispatch(showToast(`Receipt ${created.code} saved and sent`, 'success'));
      }
      handleBack();
    } catch (err) {
      dispatch(showToast(err?.data?.message || 'Failed to save the receipt', 'error'));
    }
  });

  if (isEditMode && isLoadingReceipt) {
    return (
      <Stack spacing={2}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Loading receipt…</Typography>
      </Stack>
    );
  }

  if (isEditMode && !isLoadingReceipt && !existingReceipt) {
    return (
      <Stack spacing={2}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Receipt not found</Typography>
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon fontSize="small" />} onClick={() => navigate('/stock-receipt')} sx={{ width: 'fit-content' }}>
          Back to Stock Receipt List
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'flex-start', lg: 'center' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>{isEditMode ? `Stock Receipt (Edit ${receiptCode || ''})` : 'Stock Receipt (New)'}</Typography>
          <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />} sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 12.5 } }}>
            <MuiLink component={RouterLink} to="/home" underline="hover" color="text.secondary">Home</MuiLink>
            <MuiLink component={RouterLink} to="/stock-receipt" underline="hover" color="text.secondary">Stock Receipt</MuiLink>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{isEditMode ? 'Edit Receipt' : 'New Stock Receipt'}</Typography>
          </Breadcrumbs>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', width: { xs: '100%', lg: 'auto' }, justifyContent: { xs: 'flex-start', lg: 'flex-end' } }}>
          <Button variant="outlined" color="inherit" startIcon={<ArrowBackOutlinedIcon fontSize="small" />} onClick={handleBack}>
            {isEditMode ? 'Back to Receipt' : 'Back'}
          </Button>
          <Button variant="outlined" color="inherit" startIcon={<PrintOutlinedIcon fontSize="small" />} onClick={handlePrintPreview}>
            Print / Preview
          </Button>
          {/* <Button
            variant="outlined"
            color="inherit"
            endIcon={<ExpandMoreIcon />}
            onClick={(e) => setMoreActionsAnchor(e.currentTarget)}
          >
            More Actions
          </Button> */}
          <Menu anchorEl={moreActionsAnchor} open={Boolean(moreActionsAnchor)} onClose={() => setMoreActionsAnchor(null)}>
            <MenuItem onClick={() => handleMoreAction('Save as Template')}>Save as Template</MenuItem>
            <MenuItem onClick={() => reset(createStockReceiptDefaultValues)}>Reset Form</MenuItem>
          </Menu>
          {isEditMode ? (
            <Button variant="contained" color="warning" startIcon={<SaveOutlinedIcon fontSize="small" />} onClick={onSaveAsDraft} disabled={isSaving}>
              Update Receipt
            </Button>
          ) : (
            <>
              <Button variant="outlined" color="warning" startIcon={<SaveOutlinedIcon fontSize="small" />} onClick={onSaveAsDraft} disabled={isSaving}>
                Save as Draft
              </Button>
              <Button variant="contained" color="warning" startIcon={<SendOutlinedIcon fontSize="small" />} onClick={onSaveAndSend} disabled={isSaving}>
                Save &amp; Send
              </Button>
            </>
          )}
        </Stack>
      </Stack>

      <FormProvider {...methods}>
        <Stack spacing={2} component="form" noValidate>
          {/* One card for the receipt header + supplier/source, one for
              logistics. Every row is a clean 3-up grid (lg) so labels, inputs
              and the "+" buttons share the same 56px control height and the
              columns line up from card to card. */}
          <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 3 } }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2.5 }}>Receipt &amp; Supplier Details</Typography>

            <SectionLabel>Receipt</SectionLabel>
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                <TextField
                  label="Receipt No."
                  value={receiptCode || ''}
                  disabled
                  fullWidth
                  slotProps={{
                    input: {
                      readOnly: true,
                      endAdornment: <InputAdornment position="end"><SettingsOutlinedIcon fontSize="small" /></InputAdornment>,
                    },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 4 }}><FormDatePicker name="receiptDate" label="Receipt Date *" /></Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 4 }}><FormSelect name="purchaseType" label="Purchase Type *" options={PURCHASE_TYPE_OPTIONS} /></Grid>
            </Grid>

            <Divider sx={{ mb: 2.5 }} />

            <SectionLabel>Supplier / Source</SectionLabel>
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <FormSelect name="supplier" label="Supplier *" options={supplierOptions} />
                  </Box>
                  <AddButton onClick={handleAddSupplier} label="Add supplier" />
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <FormSelect name="fromOutlet" label="From Outlet / HO *" options={outletOptions} />
                  </Box>
                  <AddButton onClick={handleAddFromOutlet} label="Add from outlet / HO" />
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 4 }}><FormTextField name="mobileNo" label="Contact Mobile No." placeholder="Enter Mobile No." /></Grid>
            </Grid>

            <FormTextField name="receiptRemarks" label="Remarks" placeholder="Enter Remarks (if any)" multiline minRows={2} />
          </Paper>

          <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 3 } }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2.5 }}>Other Details</Typography>

            <SectionLabel>Reference</SectionLabel>
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 6, lg: 4 }}><FormTextField name="referenceNo" label="Reference (if any)" placeholder="Enter Reference" /></Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 4 }}><FormTextField name="deliveryChallanNo" label="Delivery Challan No." placeholder="Enter Delivery Challan No." /></Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 4 }}><FormDatePicker name="deliveryDate" label="Delivery Date" placeholder="Select Delivery Date" /></Grid>
            </Grid>

            <Divider sx={{ mb: 2.5 }} />

            <SectionLabel>Transport &amp; Attachment</SectionLabel>
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 6, lg: 4 }}><FormTextField name="vehicleNo" label="Vehicle No." placeholder="Enter Vehicle No." /></Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 4 }}><FormTextField name="transporter" label="Transporter" placeholder="Enter Transporter" /></Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                <Box
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5, height: 56, px: 1.5,
                    border: '1px solid', borderColor: 'divider', borderRadius: 1,
                  }}
                >
                  <Button variant="outlined" color="inherit" size="small" component="label" sx={{ flexShrink: 0, textTransform: 'none' }}>
                    Choose File
                    <input type="file" hidden onChange={handleAttachmentChange} />
                  </Button>
                  <Typography variant="body2" noWrap sx={{ color: attachmentName ? 'text.primary' : 'text.secondary', minWidth: 0 }}>
                    {attachmentName || 'No file chosen'}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5, ml: 1.5 }}>
                  Attachment · Max file size: 5MB
                </Typography>
              </Grid>
            </Grid>

            <FormTextField name="otherRemarks" label="Remarks" placeholder="Enter Remarks (if any)" multiline minRows={2} />
          </Paper>

          <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 2.5 } }}>
            <ReceiptItemsTable onAddItem={handleAddItemRow} products={products} />
          </Paper>

          <BottomRow />
        </Stack>
      </FormProvider>
    </Stack>
  );
}

// Terms & Conditions / Notes / Summary totals, laid out as a 3-column row
// matching the reference, with Notes bound to the form's `notes` field.
function BottomRow() {
  return (
    <Grid container spacing={2} sx={{ alignItems: 'stretch' }}>
      <Grid size={{ xs: 12, md: 6, lg: 4 }}>
        <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 2.5 }, height: '100%' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>Terms &amp; Conditions</Typography>
          <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2.5 }}>
            {DEFAULT_TERMS.map((term) => (
              <Typography key={term} component="li" variant="body2" sx={{ color: 'text.secondary' }}>
                {term}
              </Typography>
            ))}
          </Stack>
        </Paper>
      </Grid>
      <Grid size={{ xs: 12, md: 6, lg: 4 }}>
        <NotesField />
      </Grid>
      <Grid size={{ xs: 12, lg: 4 }}>
        <ReceiptSummaryTotals />
      </Grid>
    </Grid>
  );
}

function NotesField() {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 2.5 }, height: '100%' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>Notes</Typography>
      <FormTextField name="notes" placeholder="Enter notes (optional)" multiline minRows={4} fullWidth />
    </Paper>
  );
}

// Small caps caption introducing a group of fields inside a merged card.
function SectionLabel({ children }) {
  return (
    <Typography
      variant="overline"
      sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, letterSpacing: 0.8, lineHeight: 1.5, mb: 1.5 }}
    >
      {children}
    </Typography>
  );
}

// Square "+" button sized to sit flush with a 56px select.
function AddButton({ onClick, label }) {
  return (
    <IconButton
      onClick={onClick}
      aria-label={label}
      sx={{ width: 56, height: 56, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
    >
      <AddIcon fontSize="small" />
    </IconButton>
  );
}
