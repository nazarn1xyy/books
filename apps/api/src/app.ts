import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { requestId } from 'hono/request-id';
import type { Container } from './container';
import { PayloadTooLargeError } from './core/errors';
import type { AppEnv } from './core/http';
import { errorHandler, originCheck, rateLimit, requestLogger, userOrIpKey } from './core/middleware';

const MAX_BODY_BYTES = 2 * 1024 * 1024;

export function createApp(container: Container): Hono<AppEnv> {
  const app = new Hono<AppEnv>().basePath('/api');

  app.use(requestId());
  app.use(async (c, next) => {
    c.set('user', null);
    await next();
  });
  app.use(requestLogger(container.logger));
  app.use(
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: () => {
        throw new PayloadTooLargeError();
      },
    }),
  );
  app.use(originCheck(container.config.APP_ORIGIN));

  for (const controller of container.controllers) {
    if (controller.usesSession && container.sessionMiddleware) {
      app.use(`${controller.basePath}/*`, container.sessionMiddleware);
    }
  }
  app.use(rateLimit(container.apiLimiter, userOrIpKey('api')));

  for (const controller of container.controllers) {
    app.route(controller.basePath, controller.routes());
  }

  app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404));
  app.onError(errorHandler(container.logger));
  return app;
}
