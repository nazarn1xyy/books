import type { MiddlewareHandler } from 'hono';
import { systemClock, type Clock } from './core/clock';
import type { Config } from './core/config';
import type { Database } from './core/db';
import type { AppEnv, Controller } from './core/http';
import type { Logger } from './core/logger';
import { FixedWindowRateLimiter } from './core/rate-limiter';
import { AdminController } from './modules/admin/admin.controller';
import { AdminRepository } from './modules/admin/admin.repository';
import { AdminService } from './modules/admin/admin.service';
import { AiController } from './modules/ai/ai.controller';
import { AiService } from './modules/ai/ai.service';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { PasswordHasher } from './modules/auth/password-hasher';
import { SessionCookie } from './modules/auth/session-cookie';
import { sessionMiddleware } from './modules/auth/session.middleware';
import { SessionRepository } from './modules/auth/session.repository';
import { UserRepository } from './modules/auth/user.repository';
import { CatalogClient } from './modules/catalog/catalog.client';
import { CatalogController } from './modules/catalog/catalog.controller';
import { CatalogService } from './modules/catalog/catalog.service';
import { HealthController } from './modules/health/health.controller';
import { HealthService } from './modules/health/health.service';
import {
  BookmarkSyncRepository,
  BookSyncRepository,
  FavoriteSyncRepository,
  ProgressSyncRepository,
  QuoteSyncRepository,
} from './modules/sync/entity.repositories';
import { SyncController } from './modules/sync/sync.controller';
import { SyncService } from './modules/sync/sync.service';

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
  sessionMiddleware: MiddlewareHandler<AppEnv>;
  controllers: Controller[];
  auth: AuthService;
  users: UserRepository;
}

export function createContainer(config: Config, deps: ContainerDeps): Container {
  const clock = deps.clock ?? systemClock;
  const fetchFn = deps.fetch ?? fetch;
  const { db } = deps;

  const users = new UserRepository(db);
  const auth = new AuthService(users, new SessionRepository(db), new PasswordHasher(), clock);
  const cookie = new SessionCookie(config.cookieSecure);

  const sync = new SyncService(
    db,
    {
      book: new BookSyncRepository(db),
      progress: new ProgressSyncRepository(db),
      quote: new QuoteSyncRepository(db),
      bookmark: new BookmarkSyncRepository(db),
      favorite: new FavoriteSyncRepository(db),
    },
    clock,
  );

  const [primaryCatalogHost = 'flibusta.is'] = config.catalogHosts;
  const catalog = new CatalogService(
    new CatalogClient(config.catalogHosts, fetchFn),
    new URL(`https://${primaryCatalogHost}`),
  );

  const controllers: Controller[] = [
    new HealthController(new HealthService(db)),
    new AuthController(auth, cookie, {
      ip: new FixedWindowRateLimiter(5, 60_000, clock),
      nickname: new FixedWindowRateLimiter(10, 60 * 60_000, clock),
    }),
    new SyncController(sync),
    new CatalogController(catalog),
    new AiController(new AiService(config.ai, fetchFn), new FixedWindowRateLimiter(20, 60_000, clock)),
    new AdminController(new AdminService(new AdminRepository(db))),
  ];

  return {
    config,
    logger: deps.logger,
    apiLimiter: new FixedWindowRateLimiter(120, 60_000, clock),
    sessionMiddleware: sessionMiddleware(auth, cookie),
    controllers,
    auth,
    users,
  };
}
