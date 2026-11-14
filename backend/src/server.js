import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { attachNotificationHub } from './modules/notification/notification.hub.js';

const server = app.listen(env.PORT, () => {
  console.log(`Nexora POS API listening on http://localhost:${env.PORT}`);
});

// Live notifications over WebSocket (/ws/notifications) share this HTTP server.
attachNotificationHub(server);

// Without this, every nodemon restart (or `rs`, or a crash) kills the
// process while its PrismaClient pool still holds open connections to
// Azure Postgres — node-postgres doesn't get a chance to send them a clean
// close, so they can sit there until Postgres's own idle/TCP timeout reaps
// them. Across many restarts in one dev session that adds up fast against
// a small server (see DATABASE_URL's connection_limit=5 and the Azure
// instance's own low max_connections), eventually failing every query with
// "remaining connection slots are reserved for roles with the SUPERUSER
// attribute". Closing the HTTP server and disconnecting Prisma on SIGINT/
// SIGTERM lets each restart hand its connections back cleanly instead of
// leaking them.
async function shutdown(signal) {
  console.log(`${signal} received, closing server and database connections...`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
