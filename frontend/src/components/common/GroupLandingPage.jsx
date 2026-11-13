import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Stack, Box, Typography, Breadcrumbs, Link as MuiLink, Grid, Paper, ButtonBase,
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useTranslation } from 'react-i18next';

import { usePermissions } from '../../hooks/usePermissions';


/**
 * Tile landing page for a sidebar parent menu (Sales, Marketing, Inventory).
 * Each tile opens that sub-module's own screen. `items` come from navConfig;
 * descriptions are i18n keys under `${descPrefix}.<item.key>`.
 */
function GroupTile({ item, label, description, onOpen }) {
  const Icon = item.icon;
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
      <ButtonBase
        onClick={() => onOpen(item.path)}
        sx={{
          width: '100%', height: '100%', p: 3, minHeight: 130, display: 'flex', alignItems: 'flex-start',
          gap: 1.75, textAlign: 'left', borderRadius: 3,
          transition: 'transform 0.15s, box-shadow 0.15s',
          '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 },
        }}
      >
        <Box
          sx={{
            width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: `${item.color}1F`, color: item.color,
          }}
        >
          <Icon />
        </Box>
        <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'primary.main' }}>{label}</Typography>
            <NavigateNextIcon fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
          </Stack>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>{description}</Typography>
        </Stack>
      </ButtonBase>
    </Paper>
  );
}

export default function GroupLandingPage({ titleKey, items, descPrefix }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const visibleItems = items.filter((item) => can(item.key, 'view'));

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>{t(titleKey)}</Typography>
        <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />} sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 12.5 } }}>
          <MuiLink component={RouterLink} to="/home" underline="hover" color="text.secondary">{t('common.home')}</MuiLink>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t(titleKey)}</Typography>
        </Breadcrumbs>
      </Box>

      <Grid container spacing={2}>
        {visibleItems.map((item) => (
          <Grid key={item.key} size={{ xs: 12, sm: 4 }}>
            <GroupTile
              item={item}
              label={t(item.labelKey)}
              description={t(`${descPrefix}.${item.key}`)}
              onOpen={navigate}
            />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
