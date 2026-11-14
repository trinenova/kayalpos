import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

// WebSocket hub: browsers connect to /ws/notifications?token=<JWT> and every
// notification created for their tenant is pushed to them instantly.
// `ws` is loaded lazily so the API still boots (REST + polling fallback keep
// working) if `npm install` hasn't been run yet.
const socketsByTenant = new Map();

export const WS_PATH = '/ws/notifications';

export function broadcast(tenantId, payload) {
  const set = socketsByTenant.get(tenantId);
  if (!set) return;
  const data = JSON.stringify(payload);
  for (const socket of set) {
    if (socket.readyState === 1) socket.send(data);
  }
}

export async function attachNotificationHub(server) {
  let WebSocketServer;
  try {
    ({ WebSocketServer } = await import('ws'));
  } catch {
    console.warn('[notifications] "ws" package not installed — run `npm install` in backend. Live push disabled; clients will poll.');
    return;
  }

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      socket.destroy();
      return;
    }
    if (url.pathname !== WS_PATH) return; // leave other upgrades alone

    let user;
    try {
      user = jwt.verify(url.searchParams.get('token') || '', env.JWT_SECRET);
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.tenantId = user.tenantId;
      ws.isAlive = true;
      let set = socketsByTenant.get(user.tenantId);
      if (!set) socketsByTenant.set(user.tenantId, (set = new Set()));
      set.add(ws);
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('error', () => {});
      ws.on('close', () => {
        set.delete(ws);
        if (!set.size) socketsByTenant.delete(user.tenantId);
      });
      ws.send(JSON.stringify({ type: 'ready' }));
    });
  });

  // Drop dead connections (laptop sleep, network loss) every 30s.
  const heartbeat = setInterval(() => {
    for (const set of socketsByTenant.values()) {
      for (const ws of set) {
        if (!ws.isAlive) { ws.terminate(); continue; }
        ws.isAlive = false;
        ws.ping();
      }
    }
  }, 30_000);
  heartbeat.unref();
  server.on('close', () => clearInterval(heartbeat));
}
