import { Grid, Paper, Stack, Box, Typography, Link as MuiLink } from '@mui/material';
import { alpha, lighten, darken } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import RemoveShoppingCartOutlinedIcon from '@mui/icons-material/RemoveShoppingCartOutlined';
import PlaylistAddCheckOutlinedIcon from '@mui/icons-material/PlaylistAddCheckOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import { formatNumber } from '../../../utils/format';

// Soft tinted tile with a glossy round icon badge — every colour comes from the
// active theme palette (error / warning / info), so it follows the accent theme
// and light/dark mode.
function AlertTile({ icon: Icon, iconColor, value, label, link, footnote }) {
  return (
    <Paper
      variant="outlined"
      sx={(theme) => {
        const c = theme.palette[iconColor].main;
        const dark = theme.palette.mode === 'dark';
        return {
          p: 2,
          borderRadius: 4,
          height: '100%',
          borderColor: alpha(c, dark ? 0.4 : 0.25),
          backgroundColor: theme.palette.background.paper,
          backgroundImage: `linear-gradient(160deg, ${alpha(c, dark ? 0.2 : 0.12)} 0%, ${alpha(c, dark ? 0.06 : 0.03)} 100%)`,
          boxShadow: `0 6px 18px ${alpha(c, dark ? 0.14 : 0.1)}`,
        };
      }}
    >
      <Stack spacing={1}>
        <Box
          sx={(theme) => {
            const c = theme.palette[iconColor].main;
            return {
              width: 40,
              height: 40,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              background: `linear-gradient(145deg, ${lighten(c, 0.3)} 0%, ${c} 55%, ${darken(c, 0.18)} 100%)`,
              boxShadow: `0 6px 12px ${alpha(c, 0.38)}, inset 0 1px 1px rgba(255,255,255,0.45)`,
            };
          }}
        >
          <Icon fontSize="small" />
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
          {value}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>
        {link && (
          <MuiLink component={RouterLink} to={link.to} variant="caption" underline="hover" sx={{ fontWeight: 700 }}>
            {link.label} →
          </MuiLink>
        )}
        {footnote && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {footnote}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}

/**
 * The row of operational-alert tiles on the Management Dashboard (Low
 * Stock, Out of Stock, Pending Indents/GRNs/Transfers/Approvals, SAP Sync
 * status). Purely presentational — reads its numbers from the dashboard
 * API response.
 */
export default function AlertStatsRow({ alerts }) {
  const tiles = [
    { key: 'low-stock', icon: WarningAmberOutlinedIcon, iconColor: 'error', value: formatNumber(alerts.lowStockItems), label: 'Low Stock Items', link: { label: 'View Details', to: '/stock-count' } },
    { key: 'out-of-stock', icon: RemoveShoppingCartOutlinedIcon, iconColor: 'error', value: formatNumber(alerts.outOfStockItems), label: 'Out of Stock Items', link: { label: 'View Details', to: '/stock-count' } },
    { key: 'pending-indents', icon: PlaylistAddCheckOutlinedIcon, iconColor: 'warning', value: formatNumber(alerts.pendingIndents), label: 'Pending Indents', link: { label: 'View Details', to: '/stock-indent' } },
    { key: 'pending-grns', icon: DescriptionOutlinedIcon, iconColor: 'warning', value: formatNumber(alerts.pendingGrns), label: 'Pending GRNs', link: { label: 'View Details', to: '/stock-receipt' } },
    { key: 'pending-transfers', icon: LocalShippingOutlinedIcon, iconColor: 'info', value: formatNumber(alerts.pendingTransfers), label: 'Pending Transfers', link: { label: 'View Details', to: '/stock-transfer' } },
    { key: 'pending-approvals', icon: HowToRegOutlinedIcon, iconColor: 'info', value: formatNumber(alerts.pendingApprovals), label: 'Pending Approvals', link: { label: 'View Details', to: '/cashier-panel' } },
  ];

  return (
    <Grid container spacing={2}>
      {tiles.map(({ key, ...tile }) => (
        <Grid key={key} size={{ xs: 6, sm: 4, md: 3, lg: 12 / 7 }}>
          <AlertTile {...tile} />
        </Grid>
      ))}
      <Grid size={{ xs: 6, sm: 4, md: 3, lg: 12 / 7 }}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 4, height: '100%', boxShadow: (theme) => `0 6px 18px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.3 : 0.05)}` }}>
          <Stack spacing={1}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#0A3D91',
                color: '#fff',
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              SAP
            </Box>
            {/* No SAP integration exists in this app yet — the backend
                honestly reports 'Not Integrated' rather than a fabricated
                "Connected" status, so this reads in a neutral color instead
                of the fixed green a real connection would earn. */}
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: alerts.sapSyncStatus === 'Connected' ? 'success.main' : 'text.secondary' }}>
              {alerts.sapSyncStatus}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              SAP Sync Status
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Last Sync: {alerts.sapLastSyncAt || '—'}
            </Typography>
          </Stack>
        </Paper>
      </Grid>
    </Grid>
  );
}
