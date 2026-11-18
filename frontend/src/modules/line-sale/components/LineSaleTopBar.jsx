import {
  Paper, Stack, Typography, Chip, Button, ButtonGroup, IconButton, Badge, Tooltip,
} from '@mui/material';
import { alpha, darken } from '@mui/material/styles';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';

/**
 * Compact header bar for the Line Sale billing step — Bill No./status
 * (as a subtle pill), cashier and date/time on the left; Hold Bill + Held
 * Bills merged into one compound control (hold the current bill from the
 * main button, see the held list from the attached folder button, with a
 * badge on the whole group showing how many bills are on hold right now),
 * Clear and More Actions on the right. The "Line Sales" title/icon live
 * outside this Paper — see LineSalePage, which places them at the far left
 * of the row, ahead of this bar. Only used on the "billing" step; the
 * "payment" step keeps its own title + breadcrumb header.
 */
export default function LineSaleTopBar({
  billNo, billStatus, cashierName, dateTime,
  isFullScreen, onEnterFullScreen, onExitFullScreen,
  onHoldBill, isHolding, heldCount, onOpenHeld,
  onClear,
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, px: 2, py: 1.25, flex: 1, minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={{ xs: 1.5, lg: 2 }}
        sx={{ alignItems: { xs: 'flex-start', lg: 'center' }, justifyContent: 'space-between' }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
        >
          <Chip
            label={`Bill No - ${billNo}`}
            size="small"
            sx={{
              fontWeight: 700,
              height: 26,
              bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
              color: 'primary.main',
            }}
          />
          <Chip label={billStatus} size="small" sx={{ fontWeight: 700, height: 22 }} />

          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', color: 'text.secondary' }}>
            <PersonOutlineOutlinedIcon fontSize="small" />
            <Typography variant="body2" noWrap>Cashier - {cashierName}</Typography>
          </Stack>

          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', color: 'text.secondary' }}>
            <EventOutlinedIcon fontSize="small" />
            <Typography variant="body2" noWrap>{dateTime}</Typography>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
          <Tooltip title={isFullScreen ? 'Exit full screen (Ctrl / Esc)' : 'Full screen (Ctrl)'}>
            <IconButton
              onClick={isFullScreen ? onExitFullScreen : onEnterFullScreen}
              aria-label={isFullScreen ? 'Exit full screen' : 'Enter full screen'}
            >
              {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Tooltip>

          <Badge badgeContent={heldCount} color="warning" max={99}>
            <ButtonGroup
              variant="outlined"
              color="warning"
              sx={{
                '& .MuiButtonGroup-grouped': {
                  minHeight: 44,
                  bgcolor: (t) => alpha(t.palette.warning.main, 0.16),
                  borderColor: (t) => alpha(t.palette.warning.main, 0.4),
                  color: (t) => darken(t.palette.warning.main, 0.35),
                  '&:hover': { bgcolor: (t) => alpha(t.palette.warning.main, 0.26) },
                },
              }}
            >
              <Button startIcon={<PauseCircleOutlineIcon />} onClick={onHoldBill} disabled={isHolding}>
                {isHolding ? 'Holding…' : 'Hold Bill'}
              </Button>
              <Tooltip title="View held bills">
                <Button onClick={onOpenHeld} sx={{ px: 1.25 }}>
                  <FolderOpenOutlinedIcon fontSize="small" />
                </Button>
              </Tooltip>
            </ButtonGroup>
          </Badge>

          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlineOutlinedIcon />}
            onClick={onClear}
            sx={{
              minHeight: 44,
              bgcolor: (t) => alpha(t.palette.error.main, 0.14),
              borderColor: (t) => alpha(t.palette.error.main, 0.4),
              color: (t) => darken(t.palette.error.main, 0.1),
              '&:hover': { bgcolor: (t) => alpha(t.palette.error.main, 0.24) },
            }}
          >
            Clear
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
