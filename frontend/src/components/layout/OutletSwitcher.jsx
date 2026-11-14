import { useState } from 'react';
import { Box, Button, Menu, MenuItem, Typography, Stack } from '@mui/material';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectActiveOutletId, selectCurrentUser, setSession } from '../../features/auth/authSlice';
import { showToast } from '../../features/ui/uiSlice';
import { baseApi } from '../../api/baseApi';
import { useSwitchOutletMutation } from '../../api/authApi';
import { useGetOutletsQuery } from '../../api/outletApi';

export default function OutletSwitcher() {
  const dispatch = useAppDispatch();
  const activeOutletId = useAppSelector(selectActiveOutletId);
  const allowedIds = useAppSelector((state) => state.auth.user?.allowedOutletIds);
  const currentUser = useAppSelector(selectCurrentUser);
  const [switchOutlet, { isLoading: switching }] = useSwitchOutletMutation();
  const { data } = useGetOutletsQuery();
  const [anchorEl, setAnchorEl] = useState(null);

  // Real outlets, limited to the ones assigned to this user in User
  // Management (no assignment = every active outlet).
  const all = (Array.isArray(data) ? data : data?.rows || []).filter((o) => o.isActive !== false);
  const outlets = (allowedIds?.length ? all.filter((o) => allowedIds.includes(o.id)) : all)
    .map((o) => ({ value: o.id, label: o.name }));
  const activeOutlet = outlets.find((o) => o.value === activeOutletId) || outlets[0] || { label: '…' };

  return (
    <Box>
      <Button
        onClick={(e) => setAnchorEl(e.currentTarget)}
        variant="outlined"
        color="inherit"
        sx={{
          borderColor: 'divider',
          color: 'text.primary',
          px: 1.5,
          py: 0.75,
          textTransform: 'none',
          justifyContent: 'space-between',
          minWidth: { xs: 0, sm: 220 },
        }}
        endIcon={<KeyboardArrowDownIcon fontSize="small" />}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', overflow: 'hidden' }}>
          <StorefrontOutlinedIcon fontSize="small" sx={{ color: 'primary.main', flexShrink: 0 }} />
          <Typography noWrap variant="body2" sx={{ fontWeight: 600, display: { xs: 'none', sm: 'block' } }}>
            {activeOutlet.label}
          </Typography>
        </Stack>
      </Button>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {outlets.map((outlet) => (
          <MenuItem
            key={outlet.value}
            selected={outlet.value === activeOutletId}
            disabled={switching}
            onClick={async () => {
              setAnchorEl(null);
              if (outlet.value === activeOutletId) return;
              try {
                // The server re-issues the session token for the new outlet, so
                // sales, shifts, reports etc. all follow it (not just this label).
                const res = await switchOutlet(outlet.value).unwrap();
                dispatch(setSession({ user: { ...currentUser, ...res.user }, token: res.token }));
                // Everything cached belongs to the previous outlet — refetch.
                dispatch(baseApi.util.resetApiState());
                dispatch(showToast(`Switched to ${outlet.label}`, 'success'));
              } catch (err) {
                dispatch(showToast(err?.data?.message || 'Could not switch outlet', 'error'));
              }
            }}
          >
            {outlet.label}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
