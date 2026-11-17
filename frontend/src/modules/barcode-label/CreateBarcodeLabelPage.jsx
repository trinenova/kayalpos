import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Stack, Box, Typography, Button, Menu, MenuItem, Grid, Breadcrumbs, Link as MuiLink,
  Paper, IconButton, InputAdornment,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import AddIcon from '@mui/icons-material/Add';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';

import { useAppDispatch } from '../../app/hooks';
import { showToast } from '../../features/ui/uiSlice';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import { useGetProductsQuery } from '../../api/productApi';
import { useGetBrandsQuery } from '../../api/brandApi';
import {
  useGetBarcodeLabelBatchQuery, useNextBarcodeLabelCodeQuery,
  useCreateBarcodeLabelMutation, useUpdateBarcodeLabelMutation,
} from '../../api/barcodeLabelApi';

import LabelItemsTable from './components/LabelItemsTable';
import LabelPrintSummaryCard from './components/LabelPrintSummaryCard';
import { DEFAULT_TERMS } from './components/LabelTermsAndNotes';
import {
  createBarcodeLabelSchema, createBarcodeLabelDefaultValues, emptyItemRow,
  LABEL_TYPE_OPTIONS, LABEL_SIZE_OPTIONS, PRINT_TEMPLATE_OPTIONS,
  UOM_OPTIONS, WAREHOUSE_OPTIONS,
  BARCODE_TYPE_OPTIONS, ADDITIONAL_FILTER_OPTIONS, SORT_BY_OPTIONS,
} from './createBarcodeLabelSchema';
import { batchToFormValues, formValuesToPayload } from './barcodeLabelDisplay';

/**
 * "New Barcode & Label" screen, also doubling as the Edit Batch form when
 * BarcodeLabelPage renders it with an `id` prop — everything (list, create,
 * edit, view) lives on the one /barcode-label page. Fully wired to the real
 * backend (see backend/src/modules/barcode-label): Item Category and Item
 * come from the real Product table (distinct groups / actual product rows),
 * Brand comes from the real Brand master, the Batch No. is a live preview of
 * the next real code, and both "Save as Draft" and "Save & Send" actually
 * create/update a BarcodeLabelBatch row with the same validations enforced
 * again server-side.
 *
 * Unlike Quotation/Order/Invoice, only the rows the user actually checks in
 * the items grid become part of the saved batch (see
 * LabelPrintSummaryCard's own selected-only totals) — there's no product
 * picker wired up yet (still a "coming soon" toast, same as the reference),
 * so the grid starts with a single blank editable row rather than fabricated
 * sample products.
 */
export default function CreateBarcodeLabelPage({ id: propId, onBack }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { id: paramId } = useParams();
  const id = propId ?? paramId;
  const isEditMode = Boolean(id);
  const [moreActionsAnchor, setMoreActionsAnchor] = useState(null);

  const { data: existingBatch, isLoading: isLoadingBatch } = useGetBarcodeLabelBatchQuery(id, { skip: !isEditMode });
  const { data: nextCode } = useNextBarcodeLabelCodeQuery(undefined, { skip: isEditMode });
  const { data: products = [] } = useGetProductsQuery({});
  const { data: brands = [] } = useGetBrandsQuery({});
  const [createBatch, { isLoading: isCreating }] = useCreateBarcodeLabelMutation();
  const [updateBatch, { isLoading: isUpdating }] = useUpdateBarcodeLabelMutation();
  const isSaving = isCreating || isUpdating;

  const batchCode = isEditMode ? existingBatch?.code : nextCode;

  // Real, honestly-derived option lists — Item Category is the distinct set
  // of Product.group values actually in use (never a fixed guess like
  // "Grocery"/"Dairy" that may not match this tenant's catalog), Item is the
  // real product list, and Brand is the real Brand master.
  const itemCategoryOptions = useMemo(() => {
    const groups = Array.from(new Set(products.map((p) => p.group).filter(Boolean))).sort();
    return [
      { value: '', label: 'Select Item Category', disabled: true },
      ...groups.map((g) => ({ value: g, label: g })),
    ];
  }, [products]);
  const itemOptions = useMemo(() => [
    { value: '', label: 'Select Item', disabled: true },
    ...products.map((p) => ({ value: p.code, label: `${p.name} (${p.code})` })),
  ], [products]);
  const brandOptions = useMemo(() => [
    { value: '', label: 'Select Brand', disabled: true },
    ...brands.map((b) => ({ value: b.name, label: b.name })),
  ], [brands]);
  const productByCode = useMemo(() => Object.fromEntries(products.map((p) => [p.code, p])), [products]);

  const methods = useForm({
    resolver: zodResolver(createBarcodeLabelSchema),
    defaultValues: createBarcodeLabelDefaultValues,
    mode: 'onTouched',
  });
  const { handleSubmit, reset, setValue, control } = methods;

  // Edit mode: once the real batch loads, replace the form's defaults with
  // its actual saved values (see batchToFormValues in barcodeLabelDisplay.js).
  useEffect(() => {
    if (isEditMode && existingBatch) {
      reset(batchToFormValues(existingBatch, emptyItemRow));
    }
  }, [isEditMode, existingBatch, reset]);

  // Picking a real product from the "Item" filter select also prefills the
  // first item row from that product's real data (name/HSN/UoM), so the grid
  // starts from something real rather than the user retyping what a product
  // master already knows — but it's a convenience, not a live join: once
  // saved, each item row is its own frozen snapshot (see
  // barcodeLabel.service.js's itemCreateData). Watched (rather than an
  // onChange prop on FormSelect) so RHF's own field.onChange still fires
  // normally and the form state stays correct.
  const selectedItemCode = useWatch({ control, name: 'item' });
  useEffect(() => {
    if (!selectedItemCode) return;
    const product = productByCode[selectedItemCode];
    if (!product) return;
    setValue('items.0.selected', true);
    setValue('items.0.itemCode', product.code);
    setValue('items.0.itemName', product.name);
    setValue('items.0.hsnCode', product.hsnSac || '');
    setValue('items.0.uom', product.uom || '');
    setValue('items.0.barcode', product.barcode || '');
    setValue('items.0.printQty', '1.00');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemCode, productByCode]);

  const handleBack = () => {
    if (onBack) return onBack();
    if (isEditMode) return navigate(`/barcode-label/view/${id}`);
    navigate('/barcode-label');
  };

  const handlePrintPreview = () => dispatch(showToast('Print / Preview is coming soon', 'info'));
  const handleAddCategory = () => dispatch(showToast('Item Category picker is coming soon', 'info'));
  const handleAddBrand = () => dispatch(showToast('Brand picker is coming soon', 'info'));
  const handleAddItemRow = () => dispatch(showToast('Item picker is coming soon', 'info'));
  const handleMoreAction = (label) => {
    setMoreActionsAnchor(null);
    dispatch(showToast(`${label} is coming soon`, 'info'));
  };

  const onSaveAsDraft = handleSubmit(async (values) => {
    try {
      const payload = formValuesToPayload(values, { status: 'draft' });
      if (isEditMode) {
        await updateBatch({ id, ...payload }).unwrap();
        dispatch(showToast(`Barcode & Label batch ${batchCode} updated successfully`, 'success'));
      } else {
        const created = await createBatch(payload).unwrap();
        dispatch(showToast(`Barcode & Label batch ${created.code} saved as draft`, 'success'));
      }
      handleBack();
    } catch (err) {
      dispatch(showToast(err?.data?.message || 'Failed to save the batch', 'error'));
    }
  });

  const onSaveAndSend = handleSubmit(async (values) => {
    try {
      const payload = formValuesToPayload(values, { status: 'pending-print' });
      if (isEditMode) {
        await updateBatch({ id, ...payload }).unwrap();
        dispatch(showToast(`Barcode & Label batch ${batchCode} updated successfully`, 'success'));
      } else {
        const created = await createBatch(payload).unwrap();
        dispatch(showToast(`Barcode & Label batch ${created.code} saved and sent to print queue`, 'success'));
      }
      handleBack();
    } catch (err) {
      dispatch(showToast(err?.data?.message || 'Failed to save the batch', 'error'));
    }
  });

  if (isEditMode && isLoadingBatch) {
    return (
      <Stack spacing={2}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Loading batch…</Typography>
      </Stack>
    );
  }

  if (isEditMode && !isLoadingBatch && !existingBatch) {
    return (
      <Stack spacing={2}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Batch not found</Typography>
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon fontSize="small" />} onClick={() => navigate('/barcode-label')} sx={{ width: 'fit-content' }}>
          Back to Barcode &amp; Label List
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'flex-start', lg: 'center' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>{isEditMode ? `Barcode & Label (Edit ${batchCode || ''})` : 'Barcode & Label (New)'}</Typography>
          <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />} sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 12.5 } }}>
            <MuiLink component={RouterLink} to="/home" underline="hover" color="text.secondary">Home</MuiLink>
            <MuiLink component={RouterLink} to="/barcode-label" underline="hover" color="text.secondary">Barcode &amp; Label</MuiLink>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{isEditMode ? 'Edit Batch' : 'New Barcode & Label'}</Typography>
          </Breadcrumbs>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', width: { xs: '100%', lg: 'auto' }, justifyContent: { xs: 'flex-start', lg: 'flex-end' } }}>
          <Button variant="outlined" color="inherit" startIcon={<ArrowBackOutlinedIcon fontSize="small" />} onClick={handleBack}>
            {isEditMode ? 'Back to Batch' : 'Back'}
          </Button>
          <Button variant="outlined" color="inherit" startIcon={<PrintOutlinedIcon fontSize="small" />} onClick={handlePrintPreview}>
            Print / Preview
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
            <MenuItem onClick={() => handleMoreAction('Save as Template')}>Save as Template</MenuItem>
            <MenuItem onClick={() => handleMoreAction('Import Items')}>Import Items</MenuItem>
            <MenuItem onClick={() => reset(createBarcodeLabelDefaultValues)}>Reset Form</MenuItem>
          </Menu>
          {isEditMode ? (
            <Button variant="contained" color="warning" startIcon={<SaveOutlinedIcon fontSize="small" />} onClick={onSaveAsDraft} disabled={isSaving}>
              Update Batch
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
          <Grid container spacing={2} sx={{ alignItems: 'stretch' }}>
            <Grid size={{ xs: 12, lg: 4 }}>
              <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 2.5 }, height: '100%' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Label Details</Typography>
                <Stack spacing={2}>
                  <FormTextField name="labelName" label="Label Name *" placeholder="Enter Label Name" />
                  <FormSelect name="labelType" label="Label Type *" options={LABEL_TYPE_OPTIONS} />
                  <FormSelect name="labelSize" label="Label Size *" options={LABEL_SIZE_OPTIONS} />
                  <FormSelect name="printTemplate" label="Print Template" options={PRINT_TEMPLATE_OPTIONS} />
                  <FormTextField name="labelsAcross" label="No. of Labels Across" placeholder="Enter No. of Labels Across" />
                  <FormTextField name="labelsDown" label="No. of Labels Down" placeholder="Enter No. of Labels Down" />
                  <FormTextField name="remarks" label="Remarks" placeholder="Enter Remarks (if any)" multiline minRows={3} />
                </Stack>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, lg: 8 }}>
              <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 2.5 }, height: '100%' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Filter Criteria</Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <FormSelect name="itemCategory" label="Item Category" options={itemCategoryOptions} />
                      </Box>
                      <IconButton
                        onClick={handleAddCategory}
                        sx={{ mt: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                        aria-label="Add item category"
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <FormSelect name="item" label="Item" options={itemOptions} />
                      </Box>
                      <IconButton
                        onClick={handleAddItemRow}
                        sx={{ mt: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                        aria-label="Add item"
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <FormSelect name="uom" label="UoM" options={UOM_OPTIONS} />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <FormSelect name="brand" label="Brand" options={brandOptions} />
                      </Box>
                      <IconButton
                        onClick={handleAddBrand}
                        sx={{ mt: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                        aria-label="Add brand"
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <FormSelect name="warehouse" label="Warehouse" options={WAREHOUSE_OPTIONS} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <FormTextField name="batchNo" label="Batch No." placeholder="Enter Batch No." />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <FormTextField
                      name="fromItemCode"
                      label="From Item Code"
                      placeholder="Enter From Item Code"
                      slotProps={{ input: { endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment> } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <FormTextField
                      name="toItemCode"
                      label="To Item Code"
                      placeholder="Enter To Item Code"
                      slotProps={{ input: { endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment> } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <FormSelect name="barcodeType" label="Barcode Type" options={BARCODE_TYPE_OPTIONS} />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 8 }}>
                    <FormSelect name="additionalFilter" label="Additional Filter" options={ADDITIONAL_FILTER_OPTIONS} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormSelect name="sortBy" label="Sort By" options={SORT_BY_OPTIONS} />
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>

          <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 2.5 } }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Items</Typography>
            <LabelItemsTable onAddItem={handleAddItemRow} products={products} />
          </Paper>

          <BottomRow />
        </Stack>
      </FormProvider>
    </Stack>
  );
}

// Terms & Conditions / Notes / Print Summary, laid out as a 3-column row
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
        <LabelPrintSummaryCard />
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
