import { useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  Stack, Typography, Button, Grid, TextField, CircularProgress,
} from '@mui/material';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import CloseIcon from '@mui/icons-material/Close';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';

import { useAppDispatch } from '../../../../app/hooks';
import { showToast } from '../../../../features/ui/uiSlice';
import FormTextField from '../../../../components/form/FormTextField';
import FormSelect from '../../../../components/form/FormSelect';
import { useCreateItemGroupMutation, useUpdateItemGroupMutation, useNextItemGroupCode } from '../../../../api/itemGroupApi';
import {
  createItemGroupSchema, createItemGroupDefaultValues, itemGroupToFormValues, itemGroupFormValuesToPayload, STATUS_OPTIONS,
} from '../createItemGroupSchema';

/** Add/Edit dialog for the Item Group master (same shape as BrandFormDialog). */
export default function ItemGroupFormDialog({ open, mode = 'add', initialValues, onClose }) {
  const dispatch = useAppDispatch();
  const isEdit = mode === 'edit';

  const [createItemGroup] = useCreateItemGroupMutation();
  const [updateItemGroup] = useUpdateItemGroupMutation();
  const nextCode = useNextItemGroupCode(open && !isEdit);

  const methods = useForm({
    resolver: zodResolver(createItemGroupSchema),
    defaultValues: createItemGroupDefaultValues,
    mode: 'onTouched',
  });
  const { handleSubmit, reset, formState: { isSubmitting } } = methods;

  useEffect(() => {
    if (open) reset(isEdit && initialValues ? itemGroupToFormValues(initialValues) : createItemGroupDefaultValues);
  }, [open, isEdit, initialValues, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const payload = itemGroupFormValuesToPayload(values);
      if (isEdit) {
        await updateItemGroup({ id: initialValues.id, ...payload }).unwrap();
        dispatch(showToast('Item group updated successfully', 'success'));
      } else {
        await createItemGroup(payload).unwrap();
        dispatch(showToast('Item group saved successfully', 'success'));
      }
      onClose?.();
    } catch (err) {
      dispatch(showToast(err?.data?.message || 'Failed to save item group', 'error'));
    }
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1.5 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CategoryOutlinedIcon fontSize="small" sx={{ color: 'primary.main' }} />
          <Typography sx={{ fontWeight: 800, fontSize: 17 }}>{isEdit ? 'Edit Item Group' : 'Add Item Group'}</Typography>
        </Stack>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <FormProvider {...methods}>
        <form onSubmit={onSubmit} noValidate>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Item Group Code *"
                  value={isEdit ? (initialValues?.code || '') : (nextCode || 'Auto generated')}
                  disabled
                  fullWidth
                  slotProps={{ input: { readOnly: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormTextField name="name" label="Item Group Name *" placeholder="e.g. Grocery, Beverages" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormSelect name="status" label="Status *" options={STATUS_OPTIONS} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <FormTextField name="description" label="Description" placeholder="Optional notes about this group" multiline minRows={3} />
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
