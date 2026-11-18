import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveApiBaseUrl } from '../api/baseApi';

const REQUEST_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 30000;

const UNKNOWN_SERVICES = { backend: false, database: false };

/**
 * Polls GET /api/health for the HealthStatusTag in the topbar.
 *
 * `status` is one of:
 *  - 'checking'  — a request is in flight (initial load and every refresh,
 *                  manual or polled). This is the default state.
 *  - 'healthy'   — the backend responded 2xx with status === 'healthy'
 *                  (which the backend only reports once its own DB check
 *                  passes — see backend/src/modules/health).
 *  - 'unhealthy' — anything else: fetch threw (network error), the request
 *                  timed out, the response was non-2xx, or the body's
 *                  status wasn't 'healthy'.
 *
 * `services` mirrors the backend's `{ backend, database }` shape so the tag
 * can name which dependency is down; it falls back to all-false when the
 * backend couldn't be reached at all (no body to read a real value from).
 */
export function useHealthStatus({ pollIntervalMs = POLL_INTERVAL_MS } = {}) {
  const [status, setStatus] = useState('checking');
  const [services, setServices] = useState(UNKNOWN_SERVICES);
  const [checkedAt, setCheckedAt] = useState(null);

  // Bumped on every check so a slow, now-stale request (e.g. a poll that
  // fired just before a manual refetch) can't overwrite state with an
  // outdated result after a newer check has already resolved.
  const requestIdRef = useRef(0);

  const check = useCallback(async () => {
    const requestId = (requestIdRef.current += 1);
    setStatus('checking');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let nextStatus = 'unhealthy';
    let nextServices = UNKNOWN_SERVICES;

    try {
      // Re-probe each check so failover (and fail-back) between the
      // configured API URLs happens automatically.
      const baseUrl = await resolveApiBaseUrl(true);
      const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
      const body = await res.json().catch(() => null);

      if (body?.services) {
        nextServices = body.services;
      }
      if (res.ok && body?.status === 'healthy') {
        nextStatus = 'healthy';
      }
    } catch {
      // Network error, DNS failure, or the AbortController firing on
      // timeout all land here — all treated as "couldn't reach the backend".
    } finally {
      clearTimeout(timeoutId);
    }

    if (requestId !== requestIdRef.current) return;
    setStatus(nextStatus);
    setServices(nextServices);
    setCheckedAt(new Date());
  }, []);

  useEffect(() => {
    check();
    if (!pollIntervalMs) return undefined;
    const intervalId = setInterval(check, pollIntervalMs);
    return () => clearInterval(intervalId);
  }, [check, pollIntervalMs]);

  return { status, services, checkedAt, refetch: check };
}
