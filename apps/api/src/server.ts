import { serve } from '@hono/node-server';
import { createApp } from './app';
import { loadConfig } from './core/config';
import { createDatabase } from './core/db';
import { createLogger } from './core/logger';
import { createContainer } from './container';

const SESSION_PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const SHUTDOWN_TIMEOUT_MS = 10_000;

const config = loadConfig();
const logger = createLogger(config);
const database = createDatabase(config.DATABASE_URL, config.DB_POOL_MAX);
const container = createContainer(config, { db: database.db, logger });
const app = createApp(container);

const server = serve({ fetch: app.fetch, port: config.PORT, hostname: '0.0.0.0' }, (info) =>
  logger.info({ port: info.port }, 'libify api listening'),
);

const purge = setInterval(() => {
  container.auth
    .purgeExpiredSessions()
    .then((n) => n > 0 && logger.info({ removed: n }, 'expired sessions purged'))
    .catch((err) => logger.warn({ err }, 'session purge failed'));
}, SESSION_PURGE_INTERVAL_MS);
purge.unref();

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');
  clearInterval(purge);
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
  server.close(() => {
    database
      .close()
      .catch((err) => logger.error({ err }, 'db close failed'))
      .finally(() => process.exit(0));
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
