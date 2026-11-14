import { Paper, Box, Typography, Stack, Link as MuiLink } from '@mui/material';
import { alpha, lighten, darken } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';

/**
 * Generic "card with a title bar" shell used for every panel on the
 * dashboards (Sales Overview, Recent Transactions, Low Stock Items,
 * Expense Summary, etc.) so panels only differ in their body content, not
 * in how the title/action row or padding is built.
 *
 * `action` (optional): a small control rendered top-right (e.g. a period
 * select). `link` (optional): { label, to } rendered bottom-right of body.
 *
 * `variant="panel"` (opt-in, used by the dashboards) switches to the softer,
 * rounder look: larger radius, a gentle shadow and a header with a round icon
 * badge (`icon`). Adding `tone` ('primary' | 'info' | 'success' | ...) turns
 * that header into a solid gradient strip in that theme colour, with white
 * text; `link` then moves into the strip. All colours come from the active
 * theme, so accent-theme and light/dark changes carry through. Without
 * `variant`, the card renders exactly as before.
 */
export default function InfoCard({
  title, subtitle, action, link, children, sx, dense = false, variant = 'default', icon: Icon, tone,
}) {
  if (variant === 'panel') {
    return (
      <PanelCard title={title} subtitle={subtitle} action={action} link={link} sx={sx} icon={Icon} tone={tone}>
        {children}
      </PanelCard>
    );
  }

  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column', ...sx }}>
      {(title || action) && (
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between', px: dense ? 2 : 2.5, pt: dense ? 1.5 : 2.25, pb: 1 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
          {action}
        </Stack>
      )}
      <Box sx={{ px: dense ? 2 : 2.5, pb: dense ? 1.5 : 2.25, flex: 1, minWidth: 0 }}>{children}</Box>
      {link && (
        <Box sx={{ px: dense ? 2 : 2.5, pb: 2 }}>
          <MuiLink component={RouterLink} to={link.to} variant="body2" sx={{ fontWeight: 700 }} underline="hover">
            {link.label}
          </MuiLink>
        </Box>
      )}
    </Paper>
  );
}

function PanelCard({
  title, subtitle, action, link, children, sx, icon: Icon, tone,
}) {
  const toneColor = (theme) => theme.palette[tone]?.main || theme.palette.primary.main;
  // With a gradient header the link sits in the strip (when there's no action
  // control competing for the space); otherwise it stays under the body.
  const linkInHeader = Boolean(tone && link);

  const renderLink = (onGradient) => link && (
    <MuiLink
      component={RouterLink}
      to={link.to}
      variant="body2"
      underline="hover"
      sx={onGradient ? { fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' } : { fontWeight: 700 }}
    >
      {link.label} →
    </MuiLink>
  );

  return (
    <Paper
      variant="outlined"
      sx={(theme) => ({
        borderRadius: 4,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderColor: alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.9 : 0.7),
        boxShadow: `0 6px 24px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.35 : 0.06)}`,
        ...(typeof sx === 'function' ? sx(theme) : sx),
      })}
    >
      {(title || action) && (
        <Stack
          direction="row"
          spacing={1.5}
          sx={(theme) => {
            const c = toneColor(theme);
            return {
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2.5,
              py: tone ? 1.5 : 2,
              ...(tone
                ? {
                  color: '#fff',
                  backgroundImage: `linear-gradient(100deg, ${darken(c, 0.12)} 0%, ${c} 55%, ${lighten(c, 0.18)} 100%)`,
                }
                : null),
            };
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
            {Icon && (
              <Box
                sx={(theme) => ({
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  ...(tone
                    ? { bgcolor: 'rgba(255,255,255,0.22)', color: '#fff' }
                    : { bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.12), color: 'primary.main' }),
                })}
              >
                <Icon sx={{ fontSize: 19 }} />
              </Box>
            )}
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 800, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {title}
              </Typography>
              {subtitle && (
                <Typography
                  variant="caption"
                  sx={{ color: tone ? 'rgba(255,255,255,0.8)' : 'text.secondary', display: 'block', lineHeight: 1.2, whiteSpace: 'nowrap' }}
                >
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Stack>
          {action ? (
            <Box
              sx={tone ? {
                flexShrink: 0,
                '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.96)', color: '#1F2A3C' },
                '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': { border: 'none' },
                '& .MuiSelect-icon': { color: '#1F2A3C' },
              } : { flexShrink: 0 }}
            >
              {action}
            </Box>
          ) : linkInHeader ? renderLink(true) : null}
        </Stack>
      )}
      <Box sx={{ px: 2.5, pt: title || action ? 1.5 : 2.25, pb: 2.25, flex: 1, minWidth: 0 }}>{children}</Box>
      {link && !(linkInHeader && !action) && (
        <Box sx={{ px: 2.5, pb: 2 }}>{renderLink(false)}</Box>
      )}
    </Paper>
  );
}
