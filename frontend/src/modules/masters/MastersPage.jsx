import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Stack, Box, Typography, Breadcrumbs, Link as MuiLink, Grid, Paper, ButtonBase,
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '../../app/hooks';
import { logout } from '../../features/auth/authSlice';
import { showToast } from '../../features/ui/uiSlice';

import { usePermissions } from '../../hooks/usePermissions';
import { CASHIER, useMasterItems } from './mastersMockData';

function MasterCard({ item, onOpen }) {
  const Icon = item.icon;
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
      <ButtonBase
        onClick={() => onOpen(item)}
        sx={{
          width: '100%',
          height: '100%',
          p: 2.25,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.75,
          textAlign: 'left',
          borderRadius: 3,
          transition: 'transform 0.15s, box-shadow 0.15s',
          '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 },
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: `${item.color}1F`,
            color: item.color,
            flexShrink: 0,
          }}
        >
          <Icon />
        </Box>
        <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'primary.main' }}>
              {item.label}
            </Typography>
            <NavigateNextIcon fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
          </Stack>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {item.description}
          </Typography>
        </Stack>
      </ButtonBase>
    </Paper>
  );
}

/**
 * Masters — the admin landing page for every master-data module (Company,
 * Outlet, Warehouse, Product, Brand, UOM, Tax Code, HSN/SAC, Selling
 * Price, Price List, Customer, Supplier, Employee), reached from the main
 * sidebar's "Masters" item. Each card is a shortcut into that master's own
 * management screen; none of those screens exist yet, so every card
 * surfaces a "coming soon" toast instead of navigating, matching the
 * pattern used for not-yet-built Cashier Panel quick actions.
 *
 * This is the sidebar's "Masters" submenu, so its cards translate with the
 * Topbar language switcher via useMasterItems() (English/Tamil/Hindi).
 */
export default function MastersPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const masterItems = useMasterItems().filter((item) => can(item.key, 'view'));

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login', { replace: true });
  };
  const BUILT_MASTER_KEYS = ['company', 'outlet', 'warehouse', 'product', 'brand', 'item-group', 'uom', 'tax-code', 'hsn-sac', 'selling-price', 'price-list', 'batch-serial', 'supplier', 'employee'];
  const handleOpen = (item) => {
    if (BUILT_MASTER_KEYS.includes(item.key)) {
      navigate(item.path);
      return;
    }
    dispatch(showToast(t('common.masterComingSoon', { name: item.label }), 'info'));
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>{t('common.masters')}</Typography>
          <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />} sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 12.5 } }}>
            <MuiLink component={RouterLink} to="/home" underline="hover" color="text.secondary">{t('common.home')}</MuiLink>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t('common.masters')}</Typography>
          </Breadcrumbs>
        </Box>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#2563EB' }}>
            {t('common.cashier')} : {CASHIER.name} ({CASHIER.code})
          </Typography>
          <MuiLink
            component="button"
            type="button"
            variant="body2"
            underline="hover"
            onClick={handleLogout}
            sx={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 0.5, color: '#2563EB' }}
          >
            <LogoutOutlinedIcon fontSize="inherit" /> {t('common.logout')}
          </MuiLink>
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        {masterItems.map((item) => (
          <Grid key={item.key} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <MasterCard item={item} onOpen={handleOpen} />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
