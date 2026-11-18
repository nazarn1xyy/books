import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { requestId } from 'hono/request-id';
import { SYNC_PUSH_MAX_BYTES } from '@libify/shared';
import type { Container } from './container';
import { PayloadTooLargeError } from './core/errors';
import type { AppEnv } from './core/http';
import { errorHandler, originCheck, rateLimit, requestLogger, userOrIpKey } from './core/middleware';

const DEFAULT_MAX_BODY_BYTES = 256 * 1024;
/** Routes that legitimately accept larger bodies. */
const MAX_BODY_BYTES_BY_PATH: Readonly<Record<string, number>> = { '/api/sync/push': SYNC_PUSH_MAX_BYTES };

const limitBody = (maxSize: number) =>
  bodyLimit({
    maxSize,
    onError: () => {
      throw new PayloadTooLargeError();
    },
  });

export function createApp(container: Container): Hono<AppEnv> {
  const app = new Hono<AppEnv>().basePath('/api');

  app.use(requestId());
  app.use(async (c, next) => {
    c.set('user', null);
    await next();
  });
  app.use(requestLogger(container.logger));
  const defaultBodyLimit = limitBody(DEFAULT_MAX_BODY_BYTES);
  const routeBodyLimits = new Map(Object.entries(MAX_BODY_BYTES_BY_PATH).map(([path, size]) => [path, limitBody(size)]));
  app.use((c, next) => (routeBodyLimits.get(c.req.path) ?? defaultBodyLimit)(c, next));
  app.use(originCheck(container.config.APP_ORIGIN));

  for (const controller of container.controllers) {
    if (controller.usesSession) app.use(`${controller.basePath}/*`, container.sessionMiddleware);
  }
  app.use(rateLimit(container.apiLimiter, userOrIpKey('api')));

  for (const controller of container.controllers) {
    app.route(controller.basePath, controller.routes());
  }

  app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404));
  app.onError(errorHandler(container.logger));
  return app;
}
