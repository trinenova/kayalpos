import { Box } from '@mui/material';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../app/hooks';
import { selectOpenTabPaths } from '../../features/tabs/tabsSlice';
import { protectedRoutesConfig } from '../../routes/protectedRoutesConfig';

/**
 * Replaces the plain `<Outlet/>` AppShell used to render. A normal Outlet
 * only ever has ONE route mounted at a time — react-router unmounts the
 * previous page and mounts the new one on every navigation, which is
 * exactly why switching the Sales Return (or any) tab away and back used
 * to wipe out whatever was on screen: the page's cart/search/form state
 * all lives in plain React `useState`, and that state dies with the
 * component the moment it unmounts.
 *
 * Instead, this renders one `<Routes location={{ pathname }}>` per
 * currently OPEN tab (see tabsSlice.js's `openPaths` — the same list
 * TabBar.jsx renders as pills), each matched against the exact same route
 * table App.jsx uses (`protectedRoutesConfig`), and each wrapped in a div
 * that's just hidden (`display: none`) rather than removed whenever that
 * tab isn't the active one. A tab's page component therefore mounts once,
 * the first time that tab is opened, and then simply stays mounted — with
 * all its in-progress state intact — for as long as the tab stays open.
 * Closing the tab (TabBar's close button, which removes it from
 * `openPaths`) is the only thing that actually unmounts it.
 *
 * `<Routes location={...}>` is react-router's own supported way to match
 * a route tree against a path OTHER than the browser's real current
 * location — each instance below is pinned to one tab's path regardless
 * of which tab the user is actually looking at, so `useParams()` /
 * `useLocation()` inside a given page always see THAT tab's own path, not
 * whichever tab happens to be on top.
 */
export default function KeepAliveTabContent() {
  const location = useLocation();
  const openPaths = useAppSelector(selectOpenTabPaths);

  return (
    <>
      {openPaths.map((path) => (
        <Box key={path} sx={{ display: path === location.pathname ? 'block' : 'none', height: '100%' }}>
          <Routes location={{ pathname: path }}>
            {protectedRoutesConfig.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
          </Routes>
        </Box>
      ))}
    </>
  );
}
