import { useEffect, useRef, useState } from 'react';
import {
  Badge, Box, Button, Divider, IconButton, Popover, Stack, Tooltip, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { API_BASE_URL } from '../../api/baseApi';
import { showToast } from '../../features/ui/uiSlice';
import { notificationApi } from '../../api/notificationApi';
import {
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useClearNotificationsMutation,
} from '../../api/notificationApi';

const CATEGORY_ICON = {
  sales: PointOfSaleOutlinedIcon,
  inventory: Inventory2OutlinedIcon,
  cash: PaymentsOutlinedIcon,
  masters: TuneOutlinedIcon,
};
const SEVERITY_COLOR = {
  success: 'success', info: 'info', warning: 'warning', error: 'error',
};

// ws(s)://host[:port]/ws/notifications?token=… derived from the API base URL.
function socketUrl(token) {
  const base = API_BASE_URL.replace(/\/api\/?$/, '').replace(/^http/, 'ws');
  return `${base}/ws/notifications?token=${encodeURIComponent(token)}`;
}

function timeAgo(iso) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

/**
 * Live WebSocket connection with exponential-backoff reconnect. While the
 * socket is down the bell falls back to polling every 60s (see `connected`).
 */
function useNotificationSocket(token, onNotification) {
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(onNotification);
  handlerRef.current = onNotification;

  useEffect(() => {
    if (!token) return undefined;
    let ws;
    let retry = 0;
    let timer;
    let closed = false;

    const connect = () => {
      try {
        ws = new WebSocket(socketUrl(token));
      } catch {
        timer = setTimeout(connect, 5000);
        return;
      }
      ws.onopen = () => { retry = 0; setConnected(true); };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'notification') handlerRef.current?.(msg.notification);
        } catch { /* ignore malformed frames */ }
      };
      ws.onclose = () => {
        setConnected(false);
        if (closed) return;
        retry += 1;
        timer = setTimeout(connect, Math.min(30000, 1000 * 2 ** retry));
      };
      ws.onerror = () => ws.close();
    };
    connect();

    return () => {
      closed = true;
      clearTimeout(timer);
      setConnected(false);
      if (ws) { ws.onclose = null; ws.close(); }
    };
  }, [token]);

  return connected;
}

export default function NotificationBell() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const token = useAppSelector((s) => s.auth.token);
  const userId = useAppSelector((s) => s.auth.user?.id);
  const [anchorEl, setAnchorEl] = useState(null);

  const connected = useNotificationSocket(token, (n) => {
    dispatch(notificationApi.util.invalidateTags(['Notification']));
    // Own actions are already visible on screen; only toast other people's
    // events and any warning/error alert (low stock etc.).
    if (n.createdBy !== userId || n.severity === 'warning' || n.severity === 'error') {
      dispatch(showToast(`${n.title}${n.message ? ` — ${n.message}` : ''}`, SEVERITY_COLOR[n.severity] || 'info'));
    }
  });

  const { data } = useGetNotificationsQuery(
    { limit: 30 },
    { skip: !token, pollingInterval: connected ? 0 : 60000, refetchOnFocus: true },
  );
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead] = useMarkAllNotificationsReadMutation();
  const [clearAll] = useClearNotificationsMutation();

  const items = data?.items ?? [];
  const unread = data?.unreadCount ?? 0;

  const handleClick = (n) => {
    if (!n.read) markRead(n.id);
    if (n.link) { setAnchorEl(null); navigate(n.link); }
  };

  return (
    <>
      <Tooltip title={t('common.notifications', 'Notifications')}>
        <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
          <Badge badgeContent={unread} max={99} color="error">
            <NotificationsNoneOutlinedIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 380, maxWidth: 'calc(100vw - 24px)', mt: 1, borderRadius: 2 } } }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.25 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>{t('common.notifications', 'Notifications')}</Typography>
            <Typography variant="caption" color="text.secondary">
              {unread ? `${unread} unread` : 'You are all caught up'}
              {connected ? ' · live' : ''}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5}>
            <Button size="small" disabled={!unread} onClick={() => markAllRead()}>Mark all read</Button>
            <Button size="small" color="inherit" disabled={!items.length} onClick={() => clearAll()}>Clear</Button>
          </Stack>
        </Stack>
        <Divider />
        <Box sx={{ maxHeight: 420, overflowY: 'auto' }}>
          {items.length === 0 && (
            <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
              <NotificationsNoneOutlinedIcon sx={{ fontSize: 40, opacity: 0.5 }} />
              <Typography variant="body2">No notifications yet</Typography>
            </Box>
          )}
          {items.map((n) => {
            const Icon = n.type?.startsWith('stock.') ? WarningAmberOutlinedIcon : (CATEGORY_ICON[n.category] || NotificationsNoneOutlinedIcon);
            const color = SEVERITY_COLOR[n.severity] || 'info';
            return (
              <Box
                key={n.id}
                onClick={() => handleClick(n)}
                sx={(theme) => ({
                  display: 'flex',
                  gap: 1.5,
                  px: 2,
                  py: 1.25,
                  cursor: 'pointer',
                  bgcolor: n.read ? 'transparent' : alpha(theme.palette.primary.main, 0.06),
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) },
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                })}
              >
                <Box
                  sx={(theme) => ({
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    flexShrink: 0,
                    display: 'grid',
                    placeItems: 'center',
                    color: theme.palette[color].main,
                    bgcolor: alpha(theme.palette[color].main, 0.14),
                  })}
                >
                  <Icon fontSize="small" />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" fontWeight={n.read ? 500 : 700} noWrap>{n.title}</Typography>
                  {n.message && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{n.message}</Typography>
                  )}
                  <Typography variant="caption" color="text.disabled">{timeAgo(n.createdAt)}</Typography>
                </Box>
                {!n.read && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', mt: 1 }} />}
              </Box>
            );
          })}
        </Box>
      </Popover>
    </>
  );
}
