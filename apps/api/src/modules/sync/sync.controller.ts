import { Hono } from 'hono';
import { syncPullQuerySchema, syncPushRequestSchema, type SyncPullResponse, type SyncPushResponse } from '@libify/shared';
import { currentUser, parseWith, readJson, type AppEnv, type Controller } from '../../core/http';
import { requireAuth } from '../../core/middleware';
import type { SyncService } from './sync.service';

export class SyncController implements Controller {
  readonly basePath = '/sync';
  readonly usesSession = true;

  constructor(private readonly sync: SyncService) {}

  routes(): Hono<AppEnv> {
    return new Hono<AppEnv>()
      .use(requireAuth)
      .post('/push', async (c) => {
        const { ops } = await readJson(c, syncPushRequestSchema);
        return c.json<SyncPushResponse>(await this.sync.push(currentUser(c).id, ops));
      })
      .get('/pull', async (c) => {
        const { since } = parseWith(syncPullQuerySchema, c.req.query());
        return c.json<SyncPullResponse>(await this.sync.pull(currentUser(c).id, since));
      });
  }
}
