import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Stack, Box, Typography, Breadcrumbs, Link as MuiLink, Tabs, Tab,
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

import UsersTab from './UsersTab';
import RolesTab from './RolesTab';

/**
 * User Management — role-based access control. Roles carry a menu-by-menu
 * permission matrix (View / Add / Edit / Delete / All); users are assigned a
 * role, which decides which menus they see and which actions the API allows.
 */
export default function UserManagementPage() {
  const [tab, setTab] = useState(0);

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>User Management</Typography>
        <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />} sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 12.5 } }}>
          <MuiLink component={RouterLink} to="/home" underline="hover" color="text.secondary">Home</MuiLink>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>User Management</Typography>
        </Breadcrumbs>
      </Box>

      <Tabs value={tab} onChange={(_e, value) => setTab(value)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Users" />
        <Tab label="Roles & Permissions" />
      </Tabs>

      {tab === 0 ? <UsersTab /> : <RolesTab />}
    </Stack>
  );
}
