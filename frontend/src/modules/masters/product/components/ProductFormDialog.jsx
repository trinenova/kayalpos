import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Stack, Typography, Button, Grid, TextField, CircularProgress,
  Tabs, Tab, Checkbox, FormControlLabel, Divider,
} from '@mui/material';
import { FormProvider, useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import CloseIcon from '@mui/icons-material/Close';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';

import { useAppDispatch } from '../../../../app/hooks';
import { showToast } from '../../../../features/ui/uiSlice';
import FormTextField from '../../../../components/form/FormTextField';
import FormSelect from '../../../../components/form/FormSelect';
import FormCheckbox from '../../../../components/form/FormCheckbox';
import { useGetBrandsQuery } from '../../../../api/brandApi';
import { useGetItemGroupsQuery } from '../../../../api/itemGroupApi';
import { useGetTaxCodesQuery } from '../../../../api/taxCodeApi';
import { useGetUomsQuery } from '../../../../api/uomApi';
import { useGetHsnSacCodesQuery } from '../../../../api/hsnSacApi';
import { useGetSuppliersQuery } from '../../../../api/supplierApi';
import { useGetSellingPricesQuery } from '../../../../api/sellingPriceApi';
import { useCreateProductMutation, useUpdateProductMutation, useNextProductCode } from '../../../../api/productApi';
import {
  createProductSchema, createProductDefaultValues, productToFormValues, productFormValuesToPayload,
  MANAGE_ITEM_BY_SELECT_OPTIONS, TAX_GROUP_SELECT_OPTIONS,
  BRAND_PLACEHOLDER_OPTION, TAX_CODE_PLACEHOLDER_OPTION, HSN_PLACEHOLDER_OPTION,
  SUPPLIER_PLACEHOLDER_OPTION, PURCHASING_UOM_PLACEHOLDER_OPTION, SALES_UOM_PLACEHOLDER_OPTION,
  STATUS_OPTIONS,
} from '../createProductSchema';

/**
 * Add/Edit dialog for the Product master, laid out to match the Create
 * Product mockup: header fields (Item No/Description/Item Group/Unit
 * Price + "Item Listed In") above a General/Purchase/Sales/Inventory tab
 * strip. Foreign Name/UoM Group/Price List and the Sales/Purchase Item
 * checkboxes, plus Barcode/Product Sub-Group/Product Type/Shipping Type/
 * Manage Method on the General tab, stay in the schema (productToFormValues/
 * productFormValuesToPayload) so existing rows keep round-tripping, but have
 * no field on this screen per the latest mockup.
 */
const TABS = ['General', 'Purchase', 'Sales', 'Inventory'];
const formatAmount = (v) => (v == null || v === '' ? '' : Number(v).toFixed(2));

export default function ProductFormDialog({ open, mode = 'add', initialValues, onClose }) {
  const dispatch = useAppDispatch();
  const isEdit = mode === 'edit';
  const [activeTab, setActiveTab] = useState('General');

  const [createProduct] = useCreateProductMutation();
  const [updateProduct] = useUpdateProductMutation();
  // Only fetched while the dialog is open in Add mode — skipped for Edit
  // (real code already known) and while closed.
  const nextCode = useNextProductCode(open && !isEdit);
  const { data: brands = [] } = useGetBrandsQuery(open ? { status: 'ACTIVE' } : undefined, { skip: !open });
  const { data: uoms = [] } = useGetUomsQuery(open ? { status: 'ACTIVE' } : undefined, { skip: !open });
  const { data: hsnCodes = [] } = useGetHsnSacCodesQuery(open ? { status: 'ACTIVE' } : undefined, { skip: !open });
  const { data: suppliers = [] } = useGetSuppliersQuery(open ? { status: 'ACTIVE' } : undefined, { skip: !open });

  const { data: itemGroups = [] } = useGetItemGroupsQuery(open ? { status: 'ACTIVE' } : undefined, { skip: !open });
  // Item Group options come from the Item Group master. Editing a product
  // whose saved group isn't in the active list (renamed/deactivated, or
  // bulk-imported text) keeps that value selectable.
  const itemGroupOptions = useMemo(() => {
    const options = itemGroups.map((g) => ({ value: g.name, label: g.name }));
    const existing = isEdit ? initialValues?.group : '';
    if (existing && !options.some((o) => o.value === existing)) options.push({ value: existing, label: existing });
    return options;
  }, [itemGroups, isEdit, initialValues]);

  const brandOptions = useMemo(() => {
    const options = [BRAND_PLACEHOLDER_OPTION, ...brands.map((b) => ({ value: b.name, label: b.name }))];
    // Editing a row whose brand isn't in the current active Brand list
    // (renamed/deactivated brand, or a bulk-imported free-text value) —
    // keep it selectable so opening Edit never silently blanks the field.
    const existingBrand = isEdit ? initialValues?.brand : '';
    if (existingBrand && !options.some((o) => o.value === existingBrand)) {
      options.push({ value: existingBrand, label: existingBrand });
    }
    return options;
  }, [brands, isEdit, initialValues]);

  const { data: taxCodes = [] } = useGetTaxCodesQuery(open ? { status: 'ACTIVE' } : undefined, { skip: !open });

  const taxCodeOptions = useMemo(() => {
    const options = [TAX_CODE_PLACEHOLDER_OPTION, ...taxCodes.map((t) => ({ value: t.name, label: t.name }))];
    // Editing a product whose saved tax code isn't in the active Tax
    // Category list (renamed/deactivated, or bulk-imported text) — keep it
    // selectable.
    const existingTaxCode = isEdit ? initialValues?.taxCode : '';
    if (existingTaxCode && !options.some((o) => o.value === existingTaxCode)) {
      options.push({ value: existingTaxCode, label: existingTaxCode });
    }
    return options;
  }, [taxCodes, isEdit, initialValues]);

  // A product's base/purchasing/sales UOM are no longer scoped to a UoM
  // Group on this screen (that field is hidden) — all three just list every
  // active UOM, each with its own placeholder + "keep the existing value
  // selectable even if it's no longer active" fallback.
  const baseUomOptions = useMemo(() => {
    const options = [{ value: '', label: 'Select UOM', disabled: true }, ...uoms.map((u) => ({ value: u.code, label: u.name }))];
    const existing = isEdit ? initialValues?.uom : '';
    if (existing && !options.some((o) => o.value === existing)) options.push({ value: existing, label: existing });
    return options;
  }, [uoms, isEdit, initialValues]);
  const purchasingUomOptions = useMemo(() => {
    const options = [PURCHASING_UOM_PLACEHOLDER_OPTION, ...uoms.map((u) => ({ value: u.code, label: u.name }))];
    const existing = isEdit ? initialValues?.purchasingUom : '';
    if (existing && !options.some((o) => o.value === existing)) options.push({ value: existing, label: existing });
    return options;
  }, [uoms, isEdit, initialValues]);
  const salesUomOptions = useMemo(() => {
    const options = [SALES_UOM_PLACEHOLDER_OPTION, ...uoms.map((u) => ({ value: u.code, label: u.name }))];
    const existing = isEdit ? initialValues?.salesUom : '';
    if (existing && !options.some((o) => o.value === existing)) options.push({ value: existing, label: existing });
    return options;
  }, [uoms, isEdit, initialValues]);

  const hsnOptions = useMemo(() => {
    const options = [HSN_PLACEHOLDER_OPTION, ...hsnCodes.map((h) => ({ value: h.code, label: `${h.code} — ${h.description}` }))];
    const existing = isEdit ? initialValues?.hsnSac : '';
    if (existing && !options.some((o) => o.value === existing)) options.push({ value: existing, label: existing });
    return options;
  }, [hsnCodes, isEdit, initialValues]);

  const supplierOptions = useMemo(() => {
    const options = [SUPPLIER_PLACEHOLDER_OPTION, ...suppliers.map((s) => ({ value: s.name, label: s.name }))];
    const existing = isEdit ? initialValues?.preferredVendor : '';
    if (existing && !options.some((o) => o.value === existing)) options.push({ value: existing, label: existing });
    return options;
  }, [suppliers, isEdit, initialValues]);

  // Sale Price / MRP are read-only here: they come from this product's Price
  // List (Masters > Selling Price). Prefers the row of the product's own Price
  // List, otherwise the most recently updated active one. Not available until
  // the product exists (nothing to look up while creating).
  const productId = isEdit ? initialValues?.id : undefined;
  const { data: priceData } = useGetSellingPricesQuery(
    productId ? { productId, status: 'ACTIVE', pageSize: 100 } : undefined,
    { skip: !open || !productId },
  );
  const priceListRow = useMemo(() => {
    const rows = Array.isArray(priceData) ? priceData : (priceData?.rows || []);
    if (rows.length === 0) return null;
    const own = initialValues?.priceList;
    const pool = own ? rows.filter((r) => r.priceList === own) : [];
    const candidates = pool.length ? pool : rows;
    return candidates.slice().sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0];
  }, [priceData, initialValues]);
  const priceHelper = (() => {
    if (!isEdit) return 'Comes from the Price List once the product is created';
    if (!priceListRow) return 'No price list price set for this product yet';
    return `From price list: ${priceListRow.priceList} (excl. tax)`;
  })();

  const methods = useForm({
    resolver: zodResolver(createProductSchema),
    defaultValues: createProductDefaultValues,
    mode: 'onTouched',
  });
  const { handleSubmit, reset, control, formState: { isSubmitting } } = methods;

  useEffect(() => {
    if (open) {
      reset(isEdit && initialValues ? productToFormValues(initialValues) : createProductDefaultValues);
      setActiveTab('General');
    }
  }, [open, isEdit, initialValues, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const payload = productFormValuesToPayload(values);
      if (isEdit) {
        await updateProduct({ id: initialValues.id, ...payload }).unwrap();
        dispatch(showToast('Product updated successfully', 'success'));
      } else {
        await createProduct(payload).unwrap();
        dispatch(showToast('Product saved successfully', 'success'));
      }
      onClose?.();
    } catch (err) {
      const fieldErrors = err?.data?.details && typeof err.data.details === 'object'
        ? Object.entries(err.data.details).map(([k, v]) => `${k}: ${[].concat(v).join(', ')}`).join('; ')
        : '';
      const base = err?.data?.message || (err?.status ? `Failed to save product (HTTP ${err.status})` : 'Failed to save product');
      dispatch(showToast(fieldErrors ? `${base} — ${fieldErrors}` : base, 'error'));
    }
  }, (errors) => {
    // Validation failed: previously nothing happened when the bad field sat on
    // another tab. Jump to that tab and say what's wrong.
    const generalFields = ['uom', 'brand', 'additionalIdentifier', 'packSize', 'manageItemBy', 'hsnSac', 'taxCode', 'taxGroup', 'remarks', 'isGst', 'isExcisable'];
    const tabOf = (name) => {
      if (['preferredVendor', 'purchasingUom'].includes(name)) return 'Purchase';
      if (['salesUom', 'salePrice', 'mrp'].includes(name)) return 'Sales';
      if (name === 'availableQty') return 'Inventory';
      return generalFields.includes(name) ? 'General' : null;
    };
    const [firstName, firstErr] = Object.entries(errors)[0] || [];
    const tab = tabOf(firstName);
    if (tab) setActiveTab(tab);
    dispatch(showToast(firstErr?.message ? `Please fix: ${firstErr.message}` : 'Please fix the highlighted fields', 'warning'));
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1.5 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Inventory2OutlinedIcon fontSize="small" sx={{ color: 'primary.main' }} />
          <Typography sx={{ fontWeight: 800, fontSize: 17 }}>{isEdit ? 'Edit Product' : 'Create Product'}</Typography>
        </Stack>
        <Button startIcon={<CloseIcon fontSize="small" />} color="inherit" onClick={onClose}>Close</Button>
      </DialogTitle>
      <FormProvider {...methods}>
        <form onSubmit={onSubmit} noValidate>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Product No *"
                  value={isEdit ? (initialValues?.code || '') : (nextCode || 'Auto generated')}
                  disabled
                  fullWidth
                  slotProps={{ input: { readOnly: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormTextField name="name" label="Product Name *" placeholder="Enter product name" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormSelect name="group" label="Item Group *" options={[{ value: '', label: 'Select Item Group', disabled: true }, ...itemGroupOptions]} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormTextField name="unitPrice" label="Unit Price" placeholder="0" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Stack sx={{ height: '100%', justifyContent: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Item Listed In <Typography component="span" color="error">*</Typography>
                  </Typography>
                  <Stack direction="row" spacing={2}>
                    <Controller
                      name="isInventoryItem"
                      control={control}
                      render={({ field }) => (
                        <FormControlLabel
                          control={<Checkbox size="small" checked={Boolean(field.value)} onChange={(e) => field.onChange(e.target.checked)} />}
                          label="Inventory Item"
                        />
                      )}
                    />
                  </Stack>
                </Stack>
              </Grid>
            </Grid>

            <Tabs
              value={activeTab}
              onChange={(e, v) => setActiveTab(v)}
              sx={{ mt: 2, mb: 2, minHeight: 36, borderBottom: 1, borderColor: 'divider' }}
            >
              {TABS.map((t) => <Tab key={t} value={t} label={t} sx={{ minHeight: 36, textTransform: 'none' }} />)}
            </Tabs>

            {activeTab === 'General' && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormSelect name="uom" label="UOM *" options={baseUomOptions} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormSelect name="brand" label="Brand & Manufacturer" options={brandOptions} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormTextField name="additionalIdentifier" label="Additional Identifier" placeholder="additional_identifier" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormTextField name="packSize" label="Pack Size" placeholder="e.g. 250g, 1kg, 1L" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormSelect name="manageItemBy" label="Manage Item By *" options={MANAGE_ITEM_BY_SELECT_OPTIONS} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormSelect name="hsnSac" label="HSN" options={hsnOptions} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormSelect name="taxCode" label="Tax Code" options={taxCodeOptions} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormSelect name="taxGroup" label="Tax Group" options={TAX_GROUP_SELECT_OPTIONS} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormTextField name="remarks" label="Remarks" placeholder="Enter remarks" multiline minRows={2} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Stack sx={{ height: '100%', justifyContent: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                      Item Category <Typography component="span" color="error">*</Typography>
                    </Typography>
                    <Stack direction="row" spacing={2}>
                      <FormCheckbox name="isExcisable" label="Excisable" />
                      <FormCheckbox name="isGst" label="GST" />
                    </Stack>
                  </Stack>
                </Grid>
              </Grid>
            )}

            {activeTab === 'Purchase' && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormSelect name="preferredVendor" label="Preferred Vendor" options={supplierOptions} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormSelect name="purchasingUom" label="Purchasing UoM Name" options={purchasingUomOptions} />
                </Grid>
              </Grid>
            )}

            {activeTab === 'Sales' && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Sale Price (₹)"
                    value={priceListRow ? formatAmount(priceListRow.sellingPriceExclTax) : ''}
                    placeholder="—"
                    helperText={priceHelper}
                    fullWidth
                    disabled
                    slotProps={{ input: { readOnly: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="MRP (₹)"
                    value={priceListRow ? formatAmount(priceListRow.mrp) : ''}
                    placeholder="—"
                    helperText={priceListRow ? 'From the price list' : ' '}
                    fullWidth
                    disabled
                    slotProps={{ input: { readOnly: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormSelect name="salesUom" label="Sales UoM Name" options={salesUomOptions} />
                </Grid>
              </Grid>
            )}

            {activeTab === 'Inventory' && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormTextField name="availableQty" label="Available Qty *" placeholder="0" numeric />
                </Grid>
              </Grid>
            )}

            <Divider sx={{ my: 2 }} />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormTextField name="shortId" label="Short ID" placeholder="Enter short ID (unique)" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormSelect name="status" label="Status *" options={STATUS_OPTIONS} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button variant="outlined" color="inherit" onClick={onClose}>Reset</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={14} /> : null}
            >
              {isEdit ? 'Update' : 'Save Product'}
            </Button>
          </DialogActions>
        </form>
      </FormProvider>
    </Dialog>
  );
}
