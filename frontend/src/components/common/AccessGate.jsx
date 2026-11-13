import { useLocation, useNavigate } from 'react-router-dom';
import { Paper, Stack, Typography, Button } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

import { usePermissions } from '../../hooks/usePermissions';
import { menuKeyForPath } from '../../features/permissions/permissionCatalog';

/**
 * Wraps the routed page: if the current URL belongs to a menu the user's role
 * can't view (e.g. they typed /masters/supplier by hand or reopened an old
 * tab), show a "no access" notice instead of the page. Routes outside the
 * permission catalog (Home, Settings, Profile) are always open.
 */
export default function AccessGate({ children }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { can } = usePermissions();

  const key = menuKeyForPath(pathname);
  if (!key || can(key, 'view')) return children;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, p: 5, maxWidth: 520, mx: 'auto', mt: 6 }}>
      <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
        <LockOutlinedIcon sx={{ fontSize: 44, color: 'text.secondary' }} />
        <Typography variant="h6" sx={{ fontWeight: 800 }}>You don&apos;t have access to this page</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Your role doesn&apos;t include the View permission for it. Ask an administrator to update your role in User Management.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/home')}>Go to Home</Button>
      </Stack>
    </Paper>
  );
}
