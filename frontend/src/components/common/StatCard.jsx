import { Paper, Box, Typography, Stack, Link as MuiLink } from '@mui/material';
import { alpha, lighten, darken } from '@mui/material/styles';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { Link as RouterLink } from 'react-router-dom';

/**
 * KPI tile used across every dashboard (Home, Management Dashboard, and any
 * future summary page). One component, configured via props, instead of a
 * bespoke card per metric.
 *
 * `delta` (optional): { value: '12.5%', direction: 'up' | 'down', label: 'vs Yesterday' }
 * `caption` (optional): plain gray helper text shown instead of a delta
 * (e.g. "Total Active Items") when there's no up/down comparison to show.
 * `link` (optional): { label: 'View Details', to: '/some/route' }
 * `iconShape` (optional): 'square' (default, solid color + white icon) or
 * 'circle' (soft pastel bg + colored icon, used by the Promotion summary
 * tiles).
 * `iconColor` accepts either a theme palette key ('primary', 'success', …)
 * or a literal hex color (e.g. '#8B5CF6') for one-off tile colors that
 * aren't in the palette.
 */
export default function StatCard({
  icon: Icon, iconColor = 'primary', label, value, delta, caption, link, valueColor, iconShape = 'square',
  variant = 'default',
}) {
  if (variant === 'gradient') {
    return (
      <GradientStatCard
        icon={Icon}
        iconColor={iconColor}
        label={label}
        value={value}
        delta={delta}
        caption={caption}
        link={link}
        valueColor={valueColor}
      />
    );
  }
  const isHex = iconColor.startsWith('#');
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.25,
        borderRadius: 3,
        height: '100%',
        display: 'flex',
        // Icon + content are laid out as one row spanning the *entire*
        // card (label, value, delta/caption AND the "View Details"-style
        // link all live inside the content column now) — so the icon is
        // vertically centered against everything, not just the
        // label/value block above a separately-positioned link. That's
        // what kept it landing at a different height card to card.
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1.5,
        // Enables the `cqw` (container-query width) units below: the label
        // and value fonts scale off this card's own rendered width instead
        // of the viewport's, so they shrink/grow to fit whatever width the
        // grid gives the card — 5 tiles in a row on a small laptop, or 5
        // wide tiles on an ultrawide monitor — rather than overflowing or
        // getting clipped.
        containerType: 'inline-size',
      }}
    >
      {Icon && (
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: iconShape === 'circle' ? '50%' : 2.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: iconShape === 'circle'
              ? (theme) => alpha(isHex ? iconColor : theme.palette[iconColor].main, 0.12)
              : (isHex ? iconColor : `${iconColor}.main`),
            color: iconShape === 'circle' ? (isHex ? iconColor : `${iconColor}.main`) : '#fff',
            opacity: iconShape === 'circle' ? 1 : 0.95,
            flexShrink: 0,
          }}
        >
          <Icon fontSize="small" />
        </Box>
      )}

      <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              fontWeight: 500,
              lineHeight: 1.25,
              fontSize: 'clamp(0.7rem, 3.2cqw, 0.875rem)',
              // Full label text, wrapped onto up to 2 lines instead of
              // truncated to "…" — falls back to an ellipsis only if it
              // still doesn't fit in that space.
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          >
            {label}
          </Typography>

          <Typography
            sx={{
              fontWeight: 800,
              color: valueColor || 'text.primary',
              mt: 0.25,
              fontSize: 'clamp(0.8rem, 8cqw, 1.35rem)',
              lineHeight: 1.2,
              // The full value, always on one line — shrinks (via the `cqw`
              // container-width unit) to whatever size fits this card's own
              // width, rather than wrapping or getting cut off.
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {value}
          </Typography>

          {delta && (
            <Box sx={{ mt: 0.25 }}>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                {delta.direction === 'up' ? (
                  <ArrowUpwardIcon sx={{ fontSize: 14, color: 'success.main', flexShrink: 0 }} />
                ) : (
                  <ArrowDownwardIcon sx={{ fontSize: 14, color: 'error.main', flexShrink: 0 }} />
                )}
                <Typography variant="caption" sx={{ color: delta.direction === 'up' ? 'success.main' : 'error.main', fontWeight: 700, flexShrink: 0 }}>
                  {delta.value}
                </Typography>
              </Stack>
              {delta.label && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontSize: 'clamp(0.6rem, 2.8cqw, 0.75rem)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    wordBreak: 'break-word',
                  }}
                >
                  {delta.label}
                </Typography>
              )}
            </Box>
          )}

          {caption && !delta && (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontSize: 'clamp(0.6rem, 2.8cqw, 0.75rem)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
                mt: 0.25,
              }}
            >
              {caption}
            </Typography>
          )}

          {link && (
            <MuiLink
              component={RouterLink}
              to={link.to}
              variant="caption"
              underline="hover"
              sx={{ display: 'block', fontWeight: 700, mt: 0.25 }}
            >
              {link.label}
            </MuiLink>
          )}
        </Box>
    </Paper>
  );
}

/**
 * `variant="gradient"` — the dashboards' soft, tinted KPI tile: a gradient wash
 * of the tile's colour, a glossy round icon badge and a faint oversized icon
 * watermark. Every colour is derived from the active MUI theme (palette key or
 * the passed hex) with alpha/lighten/darken, so it follows the selected accent
 * theme and light/dark mode instead of hard-coding any colours.
 */
function GradientStatCard({
  icon: Icon, iconColor, label, value, delta, caption, link, valueColor,
}) {
  const isHex = iconColor.startsWith('#');
  const resolve = (theme) => (isHex ? iconColor : theme.palette[iconColor].main);

  return (
    <Paper
      variant="outlined"
      sx={(theme) => {
        const c = resolve(theme);
        const dark = theme.palette.mode === 'dark';
        return {
          position: 'relative',
          overflow: 'hidden',
          p: 2.25,
          borderRadius: 4,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 1.75,
          containerType: 'inline-size',
          borderColor: alpha(c, dark ? 0.4 : 0.28),
          backgroundColor: theme.palette.background.paper,
          backgroundImage: `linear-gradient(135deg, ${alpha(c, dark ? 0.24 : 0.17)} 0%, ${alpha(c, dark ? 0.08 : 0.04)} 100%)`,
          boxShadow: `0 8px 22px ${alpha(c, dark ? 0.16 : 0.12)}`,
          transition: 'transform 0.18s ease, box-shadow 0.18s ease',
          '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 12px 28px ${alpha(c, dark ? 0.24 : 0.2)}` },
        };
      }}
    >
      {Icon && (
        <Icon
          sx={(theme) => ({
            position: 'absolute',
            right: -6,
            bottom: -10,
            fontSize: 92,
            color: alpha(resolve(theme), theme.palette.mode === 'dark' ? 0.16 : 0.13),
            pointerEvents: 'none',
          })}
        />
      )}

      {Icon && (
        <Box
          sx={(theme) => {
            const c = resolve(theme);
            return {
              position: 'relative',
              width: 52,
              height: 52,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: '#fff',
              background: `linear-gradient(145deg, ${lighten(c, 0.3)} 0%, ${c} 55%, ${darken(c, 0.18)} 100%)`,
              boxShadow: `0 8px 16px ${alpha(c, 0.4)}, inset 0 1px 1px rgba(255,255,255,0.45)`,
            };
          }}
        >
          <Icon />
        </Box>
      )}

      <Box sx={{ position: 'relative', minWidth: 0, flex: 1 }}>
        <Typography
          variant="body2"
          sx={{
            color: 'text.primary',
            fontWeight: 600,
            lineHeight: 1.25,
            fontSize: 'clamp(0.72rem, 3.3cqw, 0.9rem)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
          }}
        >
          {label}
        </Typography>

        <Typography
          sx={{
            fontWeight: 800,
            color: valueColor || 'text.primary',
            mt: 0.25,
            fontSize: 'clamp(0.95rem, 9.5cqw, 1.7rem)',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {value}
        </Typography>

        {delta && (
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mt: 0.25, flexWrap: 'wrap' }}>
            {delta.direction === 'up' ? (
              <ArrowUpwardIcon sx={{ fontSize: 14, color: 'success.main', flexShrink: 0 }} />
            ) : (
              <ArrowDownwardIcon sx={{ fontSize: 14, color: 'error.main', flexShrink: 0 }} />
            )}
            <Typography variant="caption" sx={{ color: delta.direction === 'up' ? 'success.main' : 'error.main', fontWeight: 700 }}>
              {delta.value}
            </Typography>
            {delta.label && (
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 'clamp(0.6rem, 2.8cqw, 0.75rem)' }}>
                {delta.label}
              </Typography>
            )}
          </Stack>
        )}

        {caption && !delta && (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25, fontSize: 'clamp(0.6rem, 2.8cqw, 0.75rem)' }}>
            {caption}
          </Typography>
        )}

        {link && (
          <MuiLink
            component={RouterLink}
            to={link.to}
            variant="caption"
            underline="hover"
            sx={{ display: 'block', fontWeight: 700, mt: 0.25 }}
          >
            {link.label} →
          </MuiLink>
        )}
      </Box>
    </Paper>
  );
}
