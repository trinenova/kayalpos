import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Stack, Typography, Button,
  TextField, FormControlLabel, Switch, CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';

import { useAppDispatch } from '../../app/hooks';
import { showToast } from '../../features/ui/uiSlice';
import { useCreateRoleMutation, useUpdateRoleMutation } from '../../api/userManagementApi';
import { emptyPermissions, normalizePermissions } from '../../features/permissions/permissionCatalog';
import PermissionMatrix from './PermissionMatrix';

/** Add / edit a role: name, description, active flag and the permission matrix. */
export default function RoleFormDialog({ open, role, onClose }) {
  const dispatch = useAppDispatch();
  const isEdit = Boolean(role);
  const [createRole] = useCreateRoleMutation();
  const [updateRole] = useUpdateRoleMutation();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [permissions, setPermissions] = useState(emptyPermissions());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(role?.name || '');
    setDescription(role?.description || '');
    setIsActive(role?.isActive ?? true);
    setPermissions(normalizePermissions(role?.permissions));
    setError('');
  }, [open, role]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Role name is required');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: name.trim(), description: description.trim() || null, isActive, permissions,
      };
      if (isEdit) await updateRole({ id: role.id, ...body }).unwrap();
      else await createRole(body).unwrap();
      dispatch(showToast(isEdit ? 'Role updated successfully' : 'Role created successfully', 'success'));
      onClose();
    } catch (err) {
      dispatch(showToast(err?.data?.message || 'Failed to save role', 'error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1.5 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <AdminPanelSettingsOutlinedIcon fontSize="small" sx={{ color: 'primary.main' }} />
          <Typography sx={{ fontWeight: 800, fontSize: 17 }}>{isEdit ? 'Edit Role' : 'Add Role'}</Typography>
        </Stack>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
            <TextField
              label="Role Name *"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              error={Boolean(error)}
              helperText={error}
              fullWidth
            />
            <FormControlLabel
              control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
              label="Active"
              sx={{ flexShrink: 0 }}
            />
          </Stack>
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Menu Permissions</Typography>
          <PermissionMatrix value={permissions} onChange={setPermissions} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="outlined" color="inherit" onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={14} /> : null}
        >
          {isEdit ? 'Update' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
