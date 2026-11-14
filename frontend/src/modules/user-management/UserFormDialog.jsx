import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Stack, Typography, Button,
  TextField, MenuItem, FormControlLabel, Switch, CircularProgress, Autocomplete, Checkbox, Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';

import { useAppDispatch } from '../../app/hooks';
import { showToast } from '../../features/ui/uiSlice';
import { useGetOutletsQuery } from '../../api/outletApi';
import { useCreateUserMutation, useUpdateUserMutation, useGetRolesQuery } from '../../api/userManagementApi';

const FULL_ACCESS = '__admin__';

const EMPTY = {
  name: '', username: '', password: '', roleId: '', outletIds: [], isActive: true,
};

/** Add / edit a user and pick the role that decides what they can see and do. */
export default function UserFormDialog({ open, user, isSelf = false, onClose }) {
  const dispatch = useAppDispatch();
  const isEdit = Boolean(user);
  const { data: roles = [] } = useGetRolesQuery();
  const { data: outletData } = useGetOutletsQuery();
  const outlets = (Array.isArray(outletData) ? outletData : outletData?.rows || []).filter((o) => o.isActive !== false);
  const [createUser] = useCreateUserMutation();
  const [updateUser] = useUpdateUserMutation();

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(user
      ? {
        name: user.name, username: user.username, password: '', roleId: user.roleId || FULL_ACCESS, outletIds: user.outletIds || [], isActive: user.isActive,
      }
      : EMPTY);
    setErrors({});
  }, [open, user]);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (form.username.trim().length < 3) next.username = 'Username must be at least 3 characters';
    if (!isEdit && form.password.length < 6) next.password = 'Password must be at least 6 characters';
    if (isEdit && form.password && form.password.length < 6) next.password = 'Password must be at least 6 characters';
    if (!form.roleId) next.roleId = 'Select a role';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        username: form.username.trim(),
        roleId: form.roleId === FULL_ACCESS ? null : form.roleId,
        outletIds: form.outletIds,
        isActive: form.isActive,
        ...(form.password ? { password: form.password } : {}),
      };
      if (isEdit) await updateUser({ id: user.id, ...body }).unwrap();
      else await createUser(body).unwrap();
      dispatch(showToast(isEdit ? 'User updated successfully' : 'User created successfully', 'success'));
      onClose();
    } catch (err) {
      dispatch(showToast(err?.data?.message || 'Failed to save user', 'error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1.5 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <PeopleAltOutlinedIcon fontSize="small" sx={{ color: 'primary.main' }} />
          <Typography sx={{ fontWeight: 800, fontSize: 17 }}>{isEdit ? 'Edit User' : 'Add User'}</Typography>
        </Stack>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField label="Full Name *" value={form.name} onChange={set('name')} error={Boolean(errors.name)} helperText={errors.name} fullWidth />
          <TextField label="Username *" value={form.username} onChange={set('username')} error={Boolean(errors.username)} helperText={errors.username} fullWidth autoComplete="off" />
          <TextField
            label={isEdit ? 'New Password' : 'Password *'}
            type="password"
            value={form.password}
            onChange={set('password')}
            error={Boolean(errors.password)}
            helperText={errors.password || (isEdit ? 'Leave blank to keep the current password' : 'At least 6 characters')}
            fullWidth
            autoComplete="new-password"
          />
          <TextField
            select
            label="Role *"
            value={form.roleId}
            onChange={set('roleId')}
            error={Boolean(errors.roleId)}
            helperText={errors.roleId || (isSelf ? 'You cannot change your own role' : undefined)}
            disabled={isSelf}
            fullWidth
          >
            <MenuItem value={FULL_ACCESS}>Administrator (full access)</MenuItem>
            {roles.filter((r) => r.isActive || r.id === user?.roleId).map((r) => (
              <MenuItem key={r.id} value={r.id}>{r.name}{r.isActive ? '' : ' (inactive)'}</MenuItem>
            ))}
          </TextField>
          <Autocomplete
            multiple
            disableCloseOnSelect
            options={outlets}
            value={outlets.filter((o) => form.outletIds.includes(o.id))}
            onChange={(_, selected) => setForm((f) => ({ ...f, outletIds: selected.map((o) => o.id) }))}
            getOptionLabel={(o) => o.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderOption={({ key, ...props }, option, { selected }) => (
              <li key={key} {...props}>
                <Checkbox size="small" checked={selected} sx={{ mr: 1, p: 0.5 }} />
                {option.name}
              </li>
            )}
            renderValue={(selected, getItemProps) => selected.map((option, index) => {
              const { key, ...itemProps } = getItemProps({ index });
              return <Chip key={key} size="small" label={option.name} {...itemProps} />;
            })}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Outlet Access"
                placeholder={form.outletIds.length ? '' : 'All outlets'}
                helperText="Pick one or more outlets this user can work in. Leave empty for all outlets."
                slotProps={{
                  ...params.slotProps,
                  input: {
                    ...params.slotProps?.input,
                    startAdornment: (
                      <>
                        <StorefrontOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.5 }} />
                        {params.slotProps?.input?.startAdornment}
                      </>
                    ),
                  },
                }}
              />
            )}
          />
          <FormControlLabel
            control={<Switch checked={form.isActive} disabled={isSelf} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />}
            label="Active (can sign in)"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="outlined" color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving} startIcon={saving ? <CircularProgress size={14} /> : null}>
          {isEdit ? 'Update' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
