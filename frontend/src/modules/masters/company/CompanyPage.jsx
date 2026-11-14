import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Stack, Box, Typography, Breadcrumbs, Link as MuiLink, Grid, Paper,
  Button, Menu, MenuItem, CircularProgress,
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { useAppDispatch } from '../../../app/hooks';
import { showToast } from '../../../features/ui/uiSlice';
import FormTextField from '../../../components/form/FormTextField';
import FormDatePicker from '../../../components/form/FormDatePicker';
import FormSelect from '../../../components/form/FormSelect';
import {
  useCompanyProfileQuery, useSaveCompanyProfileMutation,
  useAddCompanyContactMutation, useUpdateCompanyContactMutation, useDeleteCompanyContactMutation,
} from '../../../api/companyApi';

import CompanyLogoCard from './components/CompanyLogoCard';
import { logoFileToDataUrl, DEFAULT_COMPANY_LOGO_PATH } from './logoImage';
import RegisteredAddressCard from './components/RegisteredAddressCard';
import ContactPersonTable from './components/ContactPersonTable';
import ContactPersonFormDialog from './components/ContactPersonFormDialog';
import {
  createCompanySchema, createCompanyDefaultValues, companyProfileToFormValues, companyFormValuesToPayload,
  COMPANY_TYPE_OPTIONS, COUNTRY_OPTIONS, STATE_OPTIONS, CURRENCY_OPTIONS,
} from './createCompanySchema';

const TABS = ['Company Details'];

/**
 * Company — the Company master's detail/edit screen, reached from the
 * Masters page's "Company" card. It has a single "Company Details" tab
 * (Basic Information + Contact Person on the left, Company Logo +
 * Registered Address on the right).
 *
 * Company is a SINGLETON per tenant (see backend/prisma/schema.prisma's
 * Company model — tenantId is @unique), not a list like Brand/Supplier, so
 * there's exactly one profile to load/edit: useCompanyProfileQuery() reads
 * it (returning `null` for a tenant that hasn't saved one yet, which this
 * page treats as "start from a blank editable form"), and the same
 * PUT-based Save button both creates it the first time and updates it
 * after (see company.service.js's upsert). "New Company"/"Duplicate
 * Company"/"Export Details"/"Deactivate Company" stay mocked — this app
 * only models one company profile per tenant, so those don't have a real
 * operation to perform yet.
 *
 * The form starts read-only (matching a "view existing record" screen);
 * "Edit" unlocks the fields (including the Registered Address card, now a
 * real part of this same form), "Save" validates, persists, and locks them
 * again. The Contact Person grid is its own real CRUD (add/edit/delete
 * against the Company Contact endpoints) independent of the main form's
 * Edit/Save toggle, same as every other master's row-level dialog.
 */
export default function CompanyPage() {
  const dispatch = useAppDispatch();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [moreAnchor, setMoreAnchor] = useState(null);
  const [logoName, setLogoName] = useState('');
  const [logoData, setLogoData] = useState('');
  const [contactDialog, setContactDialog] = useState({ open: false, mode: 'add', row: null });

  const { data: profile, isLoading, isFetching } = useCompanyProfileQuery();
  const [saveCompanyProfile] = useSaveCompanyProfileMutation();
  const [addCompanyContact] = useAddCompanyContactMutation();
  const [updateCompanyContact] = useUpdateCompanyContactMutation();
  const [deleteCompanyContact] = useDeleteCompanyContactMutation();

  const methods = useForm({
    resolver: zodResolver(createCompanySchema),
    defaultValues: createCompanyDefaultValues,
    mode: 'onTouched',
  });
  const { handleSubmit, reset } = methods;

  // Resets the form to the real profile once it loads (or to blank
  // defaults for a tenant that has never saved one). Skipped while a save
  // is in flight so the just-submitted values aren't clobbered by a stale
  // refetch racing the mutation's own cache invalidation.
  useEffect(() => {
    if (!isFetching) {
      reset(companyProfileToFormValues(profile));
      setLogoName(profile?.logoName || '');
      setLogoData(profile?.logoData || '');
    }
  }, [profile, isFetching, reset]);

  const contacts = profile?.contacts || [];


  const handleNewCompany = () => dispatch(showToast('This app supports one company profile per tenant — use Edit to update it', 'info'));
  const handleEdit = () => setIsEditing(true);
  const handleMoreAction = (label) => {
    setMoreAnchor(null);
    dispatch(showToast(`${label} is coming soon`, 'info'));
  };
  const handleLogoUpload = async (file) => {
    if (!file) return;
    try {
      // Resized + flattened to a small PNG so it stays light to store and
      // prints cleanly on the thermal receipt.
      setLogoData(await logoFileToDataUrl(file));
      setLogoName(file.name);
    } catch {
      dispatch(showToast('Could not read that image. Please choose a PNG or JPG file.', 'error'));
    }
  };
  const handleLogoRemove = () => { setLogoName(''); setLogoData(''); };

  const onSave = handleSubmit(async (values) => {
    setIsSaving(true);
    try {
      await saveCompanyProfile(companyFormValuesToPayload(values, logoName, logoData)).unwrap();
      setIsEditing(false);
      dispatch(showToast(`${values.companyName} saved successfully`, 'success'));
    } catch (err) {
      dispatch(showToast(err?.data?.message || 'Could not save the company profile. Please try again.', 'error'));
    } finally {
      setIsSaving(false);
    }
  });

  const handleAddContact = () => setContactDialog({ open: true, mode: 'add', row: null });
  const handleEditContact = (row) => setContactDialog({ open: true, mode: 'edit', row });
  const closeContactDialog = () => setContactDialog((prev) => ({ ...prev, open: false }));

  const handleSubmitContact = async (payload) => {
    try {
      if (contactDialog.mode === 'edit') {
        await updateCompanyContact({ id: contactDialog.row.id, ...payload }).unwrap();
        dispatch(showToast('Contact person updated successfully', 'success'));
      } else {
        await addCompanyContact(payload).unwrap();
        dispatch(showToast('Contact person added successfully', 'success'));
      }
    } catch (err) {
      dispatch(showToast(err?.data?.message || 'Could not save this contact person. Please try again.', 'error'));
      throw err;
    }
  };

  const handleDeleteContact = async (row) => {
    if (!window.confirm(`Delete contact person "${row.name}"? This cannot be undone.`)) return;
    try {
      await deleteCompanyContact(row.id).unwrap();
      dispatch(showToast(`${row.name} deleted`, 'success'));
    } catch (err) {
      dispatch(showToast(err?.data?.message || 'Failed to delete contact person', 'error'));
    }
  };

  const disabledProps = { disabled: !isEditing || isSaving };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Company</Typography>
          <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />} sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 12.5 } }}>
            <MuiLink component={RouterLink} to="/home" underline="hover" color="text.secondary">Home</MuiLink>
            <MuiLink component={RouterLink} to="/masters" underline="hover" color="text.secondary">Masters</MuiLink>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Company</Typography>
          </Breadcrumbs>
        </Box>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 3, px: { xs: 1, sm: 1.5 } }}>
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={1.5}
          sx={{ alignItems: { xs: 'stretch', lg: 'center' }, justifyContent: 'space-between', py: { xs: 1, lg: 0 } }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'primary.main', px: 1.5, py: { xs: 0.5, lg: 1.5 } }}>
            {TABS[0]}
          </Typography>

          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', py: { xs: 1, lg: 1.5 }, justifyContent: { xs: 'flex-start', lg: 'flex-end' } }}>
            <Button variant="contained" color="primary" startIcon={<AddIcon fontSize="small" />} onClick={handleNewCompany}>
              New Company
            </Button>
            <Button variant="outlined" color="primary" startIcon={<EditOutlinedIcon fontSize="small" />} onClick={handleEdit} disabled={isEditing || isLoading}>
              Edit
            </Button>
            <Button
              variant="outlined"
              color="primary"
              startIcon={isSaving ? <CircularProgress size={14} /> : <SaveOutlinedIcon fontSize="small" />}
              onClick={onSave}
              disabled={!isEditing || isSaving}
            >
              Save
            </Button>
            <Button variant="outlined" color="primary" endIcon={<ExpandMoreIcon fontSize="small" />} onClick={(e) => setMoreAnchor(e.currentTarget)}>
              More
            </Button>
            <Menu anchorEl={moreAnchor} open={Boolean(moreAnchor)} onClose={() => setMoreAnchor(null)}>
              <MenuItem onClick={() => handleMoreAction('Duplicate Company')}>Duplicate Company</MenuItem>
              <MenuItem onClick={() => handleMoreAction('Export Details')}>Export Details</MenuItem>
              <MenuItem onClick={() => handleMoreAction('Deactivate Company')}>Deactivate Company</MenuItem>
            </Menu>
          </Stack>
        </Stack>
      </Paper>

      {isLoading ? (
        <Paper variant="outlined" sx={{ borderRadius: 3, p: 4, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={28} />
        </Paper>
      ) : (
        <FormProvider {...methods}>
          <Stack spacing={2} component="form" noValidate>
            <Grid container spacing={2} sx={{ alignItems: 'flex-start' }}>
              <Grid size={{ xs: 12, lg: 8 }}>
                <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 2.5 } }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>Basic Information</Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormTextField name="companyCode" label="Company Code *" {...disabledProps} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormSelect name="companyType" label="Company Type" options={COMPANY_TYPE_OPTIONS} {...disabledProps} />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormTextField name="companyName" label="Company Name *" {...disabledProps} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormDatePicker
                        name="financialYearStart"
                        label="Financial Year Start *"
                        {...disabledProps}
                      />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormTextField name="displayName" label="Display Name" {...disabledProps} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormSelect name="country" label="Country *" options={COUNTRY_OPTIONS} {...disabledProps} />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormTextField name="registrationNo" label="Registration No." {...disabledProps} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormSelect name="state" label="State *" options={STATE_OPTIONS} {...disabledProps} />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormTextField name="gstin" label="GSTIN *" {...disabledProps} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormSelect name="currency" label="Currency *" options={CURRENCY_OPTIONS} {...disabledProps} />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormTextField name="panNo" label="PAN No." {...disabledProps} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormTextField name="phone" label="Phone" {...disabledProps} />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormTextField name="fssaiNo" label="FSSAI No." {...disabledProps} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormTextField name="email" label="Email" {...disabledProps} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormTextField name="mobile" label="Mobile" {...disabledProps} />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormTextField name="website" label="Website" {...disabledProps} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormTextField name="fax" label="Fax" {...disabledProps} />
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, lg: 4 }}>
                <Stack spacing={2}>
                  <CompanyLogoCard
                    companyName={profile?.displayName || profile?.companyName}
                    logoName={logoName}
                    logoData={logoData || DEFAULT_COMPANY_LOGO_PATH}
                    onUpload={handleLogoUpload}
                    onRemove={handleLogoRemove}
                  />
                  <RegisteredAddressCard disabledProps={disabledProps} onEdit={handleEdit} isEditing={isEditing} />
                </Stack>
              </Grid>
            </Grid>

            <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 2.5 } }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>Contact Person</Typography>
              <ContactPersonTable
                rows={contacts}
                onAdd={handleAddContact}
                onEditRow={handleEditContact}
                onDeleteRow={handleDeleteContact}
              />
            </Paper>
          </Stack>
        </FormProvider>
      )}

      <ContactPersonFormDialog
        open={contactDialog.open}
        mode={contactDialog.mode}
        initialValues={contactDialog.row}
        onClose={closeContactDialog}
        onSubmit={handleSubmitContact}
      />
    </Stack>
  );
}
