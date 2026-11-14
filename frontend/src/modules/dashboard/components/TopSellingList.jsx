import { Stack, Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { formatNumber } from '../../../utils/format';

/**
 * Icon + name + quantity ranked list used on the Home dashboard's "Top
 * Selling Items" card. The Management Dashboard shows the same underlying
 * data as a full DataTable instead — both read from the same API field.
 */
export default function TopSellingList({ items }) {
  return (
    <Stack spacing={1.75}>
      {items.map((item, index) => (
        <Stack key={item.id} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Typography variant="caption" sx={{ width: 14, color: 'text.secondary', fontWeight: 700, textAlign: 'center', flexShrink: 0 }}>
            {index + 1}
          </Typography>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.12),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Inventory2OutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          </Box>
          <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontWeight: 500 }} noWrap>
            {item.name}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, flexShrink: 0 }}>
            {formatNumber(item.qty)}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}
