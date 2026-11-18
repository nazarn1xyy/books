import { Hono } from 'hono';
import type { AppEnv, Controller } from '../../core/http';
import type { HealthService } from './health.service';

export class HealthController implements Controller {
  readonly basePath = '/health';
  readonly usesSession = false;

  constructor(private readonly health: HealthService) {}

  routes(): Hono<AppEnv> {
    return new Hono<AppEnv>().get('/', async (c) => {
      const dbUp = await this.health.isDatabaseUp();
      return dbUp ? c.json({ status: 'ok', db: 'ok' }) : c.json({ status: 'degraded', db: 'down' }, 503);
    });
  }
}
