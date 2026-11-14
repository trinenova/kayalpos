import { useMemo, useState } from 'react';
import {
  Stack, Paper, Button, Table, TableHead, TableBody, TableRow, TableCell, Chip, IconButton, Tooltip,
  Typography, CircularProgress, TextField, InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';

import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectCurrentUser } from '../../features/auth/authSlice';
import { showToast } from '../../features/ui/uiSlice';
import { usePermissions } from '../../hooks/usePermissions';
import { useGetUsersQuery, useDeactivateUserMutation } from '../../api/userManagementApi';
import UserFormDialog from './UserFormDialog';

const formatDate = (value) => (value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never');

export default function UsersTab() {
  const dispatch = useAppDispatch();
  const me = useAppSelector(selectCurrentUser);
  const { can } = usePermissions();
  const { data: users = [], isLoading } = useGetUsersQuery();
  const [deactivateUser] = useDeactivateUserMutation();
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState({ open: false, user: null });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => [u.name, u.username, u.roleName, ...(u.outletNames || [])].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [users, search]);

  const handleDeactivate = async (user) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Deactivate ${user.name}? They will no longer be able to sign in.`)) return;
    try {
      await deactivateUser(user.id).unwrap();
      dispatch(showToast('User deactivated', 'success'));
    } catch (err) {
      dispatch(showToast(err?.data?.message || 'Failed to deactivate user', 'error'));
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between' }}>
        <TextField
          size="small"
          placeholder="Search by name, username or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: { sm: 320 } }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        />
        {can('user-management', 'add') && (
          <Button variant="contained" startIcon={<AddIcon fontSize="small" />} onClick={() => setDialog({ open: true, user: null })}>
            New User
          </Button>
        )}
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'rgba(0,0,0,0.02)' } }}>
              <TableCell>Name</TableCell>
              <TableCell>Username</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Outlets</TableCell>
              <TableCell>Last Login</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}><CircularProgress size={22} /></TableCell></TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>No users found.</Typography>
                </TableCell>
              </TableRow>
            )}
            {rows.map((user) => (
              <TableRow key={user.id} hover>
                <TableCell sx={{ fontWeight: 700 }}>{user.name}{user.id === me?.id ? ' (you)' : ''}</TableCell>
                <TableCell>{user.username}</TableCell>
                <TableCell>{user.roleName}</TableCell>
                <TableCell>
                  {user.outletNames?.length ? (
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
                      {user.outletNames.slice(0, 2).map((n) => <Chip key={n} label={n} size="small" variant="outlined" sx={{ height: 22 }} />)}
                      {user.outletNames.length > 2 && (
                        <Tooltip title={user.outletNames.slice(2).join(', ')}>
                          <Chip label={`+${user.outletNames.length - 2}`} size="small" sx={{ height: 22 }} />
                        </Tooltip>
                      )}
                    </Stack>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>All outlets</Typography>
                  )}
                </TableCell>
                <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{formatDate(user.lastLogin)}</TableCell>
                <TableCell>
                  <Chip
                    label={user.isActive ? 'Active' : 'Inactive'}
                    size="small"
                    sx={{
                      bgcolor: user.isActive ? 'rgba(34,160,107,0.12)' : 'rgba(229,72,77,0.12)',
                      color: user.isActive ? 'success.main' : 'error.main',
                      fontWeight: 700, height: 22,
                    }}
                  />
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {can('user-management', 'edit') && (
                    <Tooltip title="Edit user">
                      <IconButton size="small" onClick={() => setDialog({ open: true, user })}><EditOutlinedIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  )}
                  {can('user-management', 'delete') && user.isActive && user.id !== me?.id && (
                    <Tooltip title="Deactivate user">
                      <IconButton size="small" color="error" onClick={() => handleDeactivate(user)}><BlockOutlinedIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <UserFormDialog
        open={dialog.open}
        user={dialog.user}
        isSelf={Boolean(dialog.user) && dialog.user.id === me?.id}
        onClose={() => setDialog({ open: false, user: null })}
      />
    </Stack>
  );
}
