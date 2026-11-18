import { Hono } from 'hono';
import type { AdminStats } from '@libify/shared';
import type { AppEnv, Controller } from '../../core/http';
import { requireAdmin } from '../../core/middleware';
import type { AdminService } from './admin.service';

export class AdminController implements Controller {
  readonly basePath = '/admin';
  readonly usesSession = true;

  constructor(private readonly admin: AdminService) {}

  routes(): Hono<AppEnv> {
    return new Hono<AppEnv>()
      .use(requireAdmin)
      .get('/stats', async (c) => c.json<AdminStats>(await this.admin.getStats()));
  }
}
