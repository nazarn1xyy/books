import type { MiddlewareHandler } from 'hono';
import { systemClock, type Clock } from './core/clock';
import type { Config } from './core/config';
import type { Database } from './core/db';
import type { AppEnv, Controller } from './core/http';
import type { Logger } from './core/logger';
import { FixedWindowRateLimiter } from './core/rate-limiter';
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
  sessionMiddleware: MiddlewareHandler<AppEnv> | null;
}

export function createContainer(config: Config, deps: ContainerDeps): Container {
  const clock = deps.clock ?? systemClock;
  const apiLimiter = new FixedWindowRateLimiter(120, 60_000, clock);

  const controllers: Controller[] = [new HealthController(new HealthService(deps.db))];

  return { config, logger: deps.logger, apiLimiter, controllers, sessionMiddleware: null };
}
