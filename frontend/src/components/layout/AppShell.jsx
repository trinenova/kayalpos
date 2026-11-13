import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Box, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_RAIL_WIDTH } from './Sidebar';
import Topbar from './Topbar';
import TabBar from './TabBar';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectSidebarOpen, toggleSidebar, selectMaxOpenTabs, showToast } from '../../features/ui/uiSlice';
import { openTab, selectOpenTabPaths } from '../../features/tabs/tabsSlice';
import { useAccessSync } from '../../hooks/useAccessSync';
import AccessGate from '../common/AccessGate';

/**
 * Shared shell for every authenticated page: Sidebar + Topbar + content
 * outlet. Below `md` the sidebar becomes a temporary overlay drawer (closed
 * by default, opened via the topbar menu button — purely local UI state);
 * at/above `md` it's a permanent rail that can collapse to icons-only
 * (that collapsed/expanded state is the one thing worth sharing globally,
 * hence it lives in the ui redux slice).
 */
export default function AppShell() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const dispatch = useAppDispatch();
  useAccessSync();
  const sidebarExpanded = useAppSelector(selectSidebarOpen);
  const maxOpenTabs = useAppSelector(selectMaxOpenTabs);
  const openTabPaths = useAppSelector(selectOpenTabPaths);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  const desktopWidth = sidebarExpanded ? SIDEBAR_WIDTH : SIDEBAR_RAIL_WIDTH;

  // Every navigation opens (or re-focuses) a tab for the current route —
  // see TabBar.jsx for the strip itself and tabsSlice.js for the cap logic
  // driven by Settings > Tabs > "Max open tabs". Tabs never auto-close: at
  // the cap, opening this route as a *new* tab is simply refused (the page
  // itself still renders via the route below — only the tab pill for it
  // doesn't appear) and a warning explains why, so the user closes one
  // manually instead of losing an existing tab without being told.
  useEffect(() => {
    const isNewTab = !openTabPaths.includes(location.pathname);
    if (isNewTab && openTabPaths.length >= maxOpenTabs) {
      dispatch(showToast(`Tab limit reached (${maxOpenTabs} max). Close a tab before opening a new one.`, 'warning'));
      return;
    }
    dispatch(openTab(location.pathname, maxOpenTabs));
    // openTabPaths is intentionally excluded — it changes as a *result* of
    // this effect (dispatch(openTab) mutates it), and including it would
    // just re-run this same logic against its own output every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, location.pathname, maxOpenTabs]);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {isDesktop ? (
        <Sidebar variant="permanent" collapsed={!sidebarExpanded} />
      ) : (
        <Sidebar
          variant="temporary"
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          onNavigate={() => setMobileNavOpen(false)}
        />
      )}

      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          width: isDesktop ? `calc(100% - ${desktopWidth}px)` : '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ position: 'sticky', top: 0, zIndex: (t) => t.zIndex.appBar }}>
          <Topbar onMenuClick={() => (isDesktop ? dispatch(toggleSidebar()) : setMobileNavOpen((v) => !v))} />
          <TabBar />
        </Box>
        <Box component="main" sx={{ flex: 1, p: { xs: 1.5, sm: 2, md: 3 } }}>
          <AccessGate><Outlet /></AccessGate>
        </Box>
        <Footer />
      </Box>
    </Box>
  );
}

function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        px: { xs: 1.5, sm: 2, md: 3 },
        py: 2,
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textAlign: 'center' }}>
        © 2026 Techconz Nexora Pvt Ltd. All Rights Reserved.
      </Typography>
    </Box>
  );
}
