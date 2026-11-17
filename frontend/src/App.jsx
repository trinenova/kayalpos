import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './modules/auth/LoginPage';
import ProtectedRoute from './routes/ProtectedRoute';
import GuestRoute from './routes/GuestRoute';
import AppShell from './components/layout/AppShell';
import GlobalToast from './components/common/GlobalToast';
import { useAuthSync } from './hooks/useAuthSync';
import { useInactivityTimeout } from './hooks/useInactivityTimeout';
import { protectedRoutesConfig } from './routes/protectedRoutesConfig';

export default function App() {
  useAuthSync();
  useInactivityTimeout();
  return (
    <>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          {/* AppShell no longer renders these via <Outlet/> — it renders
              every currently *open tab* at once (see
              components/layout/KeepAliveTabContent.jsx), keeping each
              page's component mounted (just hidden) while you're on a
              different tab, instead of unmounting/remounting it on every
              switch. This nested route list is still exactly what it was
              before: it's what makes react-router actually match these
              paths under AppShell at all (so the top-level `*` fallback
              below still only catches genuinely unknown paths, and
              ProtectedRoute/GuestRoute gating is unaffected) — it's just
              that nothing renders through it via Outlet anymore. */}
          <Route element={<AppShell />}>
            {protectedRoutesConfig.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      <GlobalToast />
    </>
  );
}
