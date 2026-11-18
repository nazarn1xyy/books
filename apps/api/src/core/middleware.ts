import type { ErrorHandler, MiddlewareHandler } from 'hono';
import type { AppEnv } from './http';
import { clientIp } from './http';
import { AppError, ForbiddenError, RateLimitError, UnauthorizedError } from './errors';
import type { Logger } from './logger';
import type { FixedWindowRateLimiter } from './rate-limiter';

export function requestLogger(logger: Logger): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const start = performance.now();
    await next();
    logger.info(
      {
        requestId: c.get('requestId'),
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        ms: Math.round(performance.now() - start),
      },
      'request',
    );
  };
}

export function errorHandler(logger: Logger): ErrorHandler<AppEnv> {
  return (err, c) => {
    if (err instanceof AppError) {
      for (const [name, value] of Object.entries(err.headers)) c.header(name, value);
      return c.json(err.toBody(), err.status);
    }
    logger.error({ err, requestId: c.get('requestId') }, 'unhandled error');
    return c.json({ error: { code: 'INTERNAL', message: 'Internal server error' } }, 500);
  };
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** CSRF defence for cookie auth: state-changing requests must come from our own origin. */
export function originCheck(allowedOrigin: string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (!SAFE_METHODS.has(c.req.method) && c.req.header('origin') !== allowedOrigin) {
      throw new ForbiddenError('Cross-origin request blocked');
    }
    await next();
  };
}

export function rateLimit(
  limiter: FixedWindowRateLimiter,
  keyOf: (c: Parameters<MiddlewareHandler<AppEnv>>[0]) => string,
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const result = limiter.consume(keyOf(c));
    if (!result.allowed) throw new RateLimitError(result.retryAfterSec);
    await next();
  };
}

export const userOrIpKey = (prefix: string) => (c: Parameters<MiddlewareHandler<AppEnv>>[0]) =>
  `${prefix}:${c.get('user')?.id ?? `ip:${clientIp(c)}`}`;

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('user')) throw new UnauthorizedError();
  await next();
};

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get('user');
  if (!user) throw new UnauthorizedError();
  if (user.role !== 'admin') throw new ForbiddenError('Admins only');
  await next();
};
