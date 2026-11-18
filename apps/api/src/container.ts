import type { MiddlewareHandler } from 'hono';
import { systemClock, type Clock } from './core/clock';
import type { Config } from './core/config';
import type { Database } from './core/db';
import type { AppEnv, Controller } from './core/http';
import type { Logger } from './core/logger';
import { FixedWindowRateLimiter } from './core/rate-limiter';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { PasswordHasher } from './modules/auth/password-hasher';
import { SessionCookie } from './modules/auth/session-cookie';
import { sessionMiddleware } from './modules/auth/session.middleware';
import { SessionRepository } from './modules/auth/session.repository';
import { UserRepository } from './modules/auth/user.repository';
import { HealthController } from './modules/health/health.controller';
import { HealthService } from './modules/health/health.service';

export interface ContainerDeps {
  db: Database;
  logger: Logger;
  clock?: Clock;
  fetch?: typeof fetch;
}

export interface Container {
  config: Config;
  logger: Logger;
  apiLimiter: FixedWindowRateLimiter;
  controllers: Controller[];
  sessionMiddleware: MiddlewareHandler<AppEnv>;
  auth: AuthService;
  users: UserRepository;
}

export function createContainer(config: Config, deps: ContainerDeps): Container {
  const clock = deps.clock ?? systemClock;
  const apiLimiter = new FixedWindowRateLimiter(120, 60_000, clock);

  const users = new UserRepository(deps.db);
  const auth = new AuthService(users, new SessionRepository(deps.db), new PasswordHasher(), clock);
  const cookie = new SessionCookie(config.cookieSecure);

  const controllers: Controller[] = [
    new HealthController(new HealthService(deps.db)),
    new AuthController(auth, cookie, {
      ip: new FixedWindowRateLimiter(5, 60_000, clock),
      nickname: new FixedWindowRateLimiter(10, 60 * 60_000, clock),
    }),
  ];

  return {
    config,
    logger: deps.logger,
    apiLimiter,
    controllers,
    auth,
    users,
    sessionMiddleware: sessionMiddleware(auth, cookie),
  };
}
