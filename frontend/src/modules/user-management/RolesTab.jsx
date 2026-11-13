import { useState } from 'react';
import {
  Stack, Paper, Button, Table, TableHead, TableBody, TableRow, TableCell, Chip, IconButton,
  Tooltip, Typography, CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';

import { useAppDispatch } from '../../app/hooks';
import { showToast } from '../../features/ui/uiSlice';
import { usePermissions } from '../../hooks/usePermissions';
import { useGetRolesQuery, useDeleteRoleMutation } from '../../api/userManagementApi';
import { LEAVES } from '../../features/permissions/permissionCatalog';
import RoleFormDialog from './RoleFormDialog';

const statusChip = (active) => (
  <Chip
    label={active ? 'Active' : 'Inactive'}
    size="small"
    sx={{
      bgcolor: active ? 'rgba(34,160,107,0.12)' : 'rgba(229,72,77,0.12)',
      color: active ? 'success.main' : 'error.main',
      fontWeight: 700, height: 22,
    }}
  />
);

export default function RolesTab() {
  const dispatch = useAppDispatch();
  const { can } = usePermissions();
  const { data: roles = [], isLoading } = useGetRolesQuery();
  const [deleteRole] = useDeleteRoleMutation();
  const [dialog, setDialog] = useState({ open: false, role: null });

  const handleDelete = async (role) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete role "${role.name}"?`)) return;
    try {
      await deleteRole(role.id).unwrap();
      dispatch(showToast('Role deleted', 'success'));
    } catch (err) {
      dispatch(showToast(err?.data?.message || 'Failed to delete role', 'error'));
    }
  };

  const grantedCount = (role) => LEAVES.filter((leaf) => role.permissions?.[leaf.key]?.view).length;

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
        {can('user-management', 'add') && (
          <Button variant="contained" startIcon={<AddIcon fontSize="small" />} onClick={() => setDialog({ open: true, role: null })}>
            New Role
          </Button>
        )}
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'rgba(0,0,0,0.02)' } }}>
              <TableCell>Role</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="center">Menus Accessible</TableCell>
              <TableCell align="center">Users</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><CircularProgress size={22} /></TableCell></TableRow>
            )}
            {!isLoading && roles.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    No roles yet. Create one, set its permissions, then assign it to users.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {roles.map((role) => (
              <TableRow key={role.id} hover>
                <TableCell sx={{ fontWeight: 700 }}>{role.name}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{role.description || '-'}</TableCell>
                <TableCell align="center">{grantedCount(role)} / {LEAVES.length}</TableCell>
                <TableCell align="center">{role.userCount}</TableCell>
                <TableCell>{statusChip(role.isActive)}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {can('user-management', 'edit') && (
                    <Tooltip title="Edit role & permissions">
                      <IconButton size="small" onClick={() => setDialog({ open: true, role })}><EditOutlinedIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  )}
                  {can('user-management', 'delete') && (
                    <Tooltip title={role.userCount ? 'Reassign its users first' : 'Delete role'}>
                      <span>
                        <IconButton size="small" color="error" disabled={role.userCount > 0} onClick={() => handleDelete(role)}>
                          <DeleteOutlineOutlinedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <RoleFormDialog open={dialog.open} role={dialog.role} onClose={() => setDialog({ open: false, role: null })} />
    </Stack>
  );
}
