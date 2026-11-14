import { Stack, Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';

/**
 * Standard page title block (title + optional subtitle + right-aligned
 * actions). Reuse this for every module page's header instead of a
 * one-off Typography/Stack combo per page.
 *
 * `icon` (optional): a round, theme-tinted badge shown before the title
 * (used by the dashboards). Omit it for the plain header.
 */
export default function PageHeader({ title, subtitle, action, icon: Icon }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', mb: 2 }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
        {Icon && (
          <Box
            sx={(theme) => ({
              width: 44,
              height: 44,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: 'primary.main',
              bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.12),
              boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`,
            })}
          >
            <Icon />
          </Box>
        )}
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Stack>
      {action}
    </Stack>
  );
}
