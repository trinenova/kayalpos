import { useEffect, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  Stack, Typography, Button, Grid, TextField, CircularProgress,
} from '@mui/material';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import CloseIcon from '@mui/icons-material/Close';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';

import { useAppDispatch } from '../../../../app/hooks';
import { showToast } from '../../../../features/ui/uiSlice';
import FormTextField from '../../../../components/form/FormTextField';
import FormSelect from '../../../../components/form/FormSelect';
import FormAutocomplete from '../../../../components/form/FormAutocomplete';
import { useCreateSupplierMutation, useUpdateSupplierMutation, useNextSupplierCode } from '../../../../api/supplierApi';
import {
  createSupplierSchema, createSupplierDefaultValues, supplierToFormValues, supplierFormValuesToPayload,
  GROUP_SELECT_OPTIONS, STATUS_OPTIONS, COUNTRY_NAMES, getStateNames, getCityNames,
} from '../createSupplierSchema';

/**
 * Add/Edit dialog for the Supplier master, backed by the real Supplier API
 * (see api/supplierApi.js) — react-hook-form + zod, same shape as
 * Brand/HSN-SAC/Price List's own form dialogs (FormTextField/FormSelect +
 * inline per-field errors), validated against the same rules as the
 * backend's createSupplierSchema (supplier.schema.js) before the request
 * ever leaves the browser — including the phone/GSTIN format checks, not
 * just "is it non-empty". Supplier Code is server-generated (SUPP-0001, ...)
 * and shown read-only, same convention as Product/Brand/Outlet's own codes.
 */
export default function SupplierFormDialog({ open, mode = 'add', initialValues, onClose }) {
  const dispatch = useAppDispatch();
  const isEdit = mode === 'edit';

  const [createSupplier] = useCreateSupplierMutation();
  const [updateSupplier] = useUpdateSupplierMutation();
  // Only fetched while the dialog is open in Add mode — skipped for Edit
  // (real code already known) and while closed.
  const nextCode = useNextSupplierCode(open && !isEdit);

  const methods = useForm({
    resolver: zodResolver(createSupplierSchema),
    defaultValues: createSupplierDefaultValues,
    mode: 'onTouched',
  });
  const {
    handleSubmit, reset, setValue, control, formState: { isSubmitting },
  } = methods;

  // State options depend on Country, City options on Country + State.
  const country = useWatch({ control, name: 'country' });
  const state = useWatch({ control, name: 'state' });
  const stateOptions = useMemo(() => getStateNames(country), [country]);
  const cityOptions = useMemo(() => getCityNames(country, state), [country, state]);

  useEffect(() => {
    if (open) reset(isEdit && initialValues ? supplierToFormValues(initialValues) : createSupplierDefaultValues);
  }, [open, isEdit, initialValues, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const payload = supplierFormValuesToPayload(values);
      if (isEdit) {
        await updateSupplier({ id: initialValues.id, ...payload }).unwrap();
        dispatch(showToast('Supplier updated successfully', 'success'));
      } else {
        await createSupplier(payload).unwrap();
        dispatch(showToast('Supplier saved successfully', 'success'));
      }
      onClose?.();
    } catch (err) {
      dispatch(showToast(err?.data?.message || 'Failed to save supplier', 'error'));
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1.5 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <PeopleAltOutlinedIcon fontSize="small" sx={{ color: 'primary.main' }} />
          <Typography sx={{ fontWeight: 800, fontSize: 17 }}>{isEdit ? 'Edit Supplier' : 'Add Supplier'}</Typography>
        </Stack>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <FormProvider {...methods}>
        <form onSubmit={onSubmit} noValidate>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Supplier Code *"
                  value={isEdit ? (initialValues?.code || '') : (nextCode || 'Auto generated')}
                  disabled
                  fullWidth
                  slotProps={{ input: { readOnly: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormTextField name="name" label="Supplier Name *" placeholder="Enter supplier name" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormSelect name="group" label="Supplier Group" options={GROUP_SELECT_OPTIONS} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormTextField name="phone" label="Phone" placeholder="Enter 10-digit phone number" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormTextField name="email" label="Email" placeholder="Enter email address" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormTextField name="gstNo" label="GST No." placeholder="15-character GSTIN" maxLength={15} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <FormTextField name="address" label="Address" placeholder="Door no., street, area" multiline minRows={2} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormAutocomplete
                  name="country"
                  label="Country"
                  options={COUNTRY_NAMES}
                  onValueChange={() => { setValue('state', ''); setValue('city', ''); }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormAutocomplete
                  name="state"
                  label="State"
                  options={stateOptions}
                  disabled={!country}
                  onValueChange={() => setValue('city', '')}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormAutocomplete name="city" label="City" options={cityOptions} disabled={!state} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormTextField name="paymentTerms" label="Payment Terms" placeholder="e.g. 30 Days" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormSelect name="status" label="Status *" options={STATUS_OPTIONS} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <FormTextField name="remarks" label="Remarks" placeholder="Any notes about this supplier" multiline minRows={2} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button variant="outlined" color="inherit" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={14} /> : null}
            >
              {isEdit ? 'Update' : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </FormProvider>
    </Dialog>
  );
}
