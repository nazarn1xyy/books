import { Hono } from 'hono';
import { aiSummarizeRequestSchema, type AiStatusResponse, type AiSummarizeResponse } from '@libify/shared';
import { readJson, type AppEnv, type Controller } from '../../core/http';
import { rateLimit, requireAuth, userOrIpKey } from '../../core/middleware';
import type { FixedWindowRateLimiter } from '../../core/rate-limiter';
import type { AiService } from './ai.service';

export class AiController implements Controller {
  readonly basePath = '/ai';
  readonly usesSession = true;

  constructor(
    private readonly ai: AiService,
    private readonly limiter: FixedWindowRateLimiter,
  ) {}

  routes(): Hono<AppEnv> {
    return new Hono<AppEnv>()
      .get('/status', (c) => c.json<AiStatusResponse>({ enabled: this.ai.enabled }))
      .post('/summarize', requireAuth, rateLimit(this.limiter, userOrIpKey('ai')), async (c) => {
        const { text } = await readJson(c, aiSummarizeRequestSchema);
        return c.json<AiSummarizeResponse>({ summary: await this.ai.summarize(text) });
      });
  }
}
