import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/core/config';

const base = { DATABASE_URL: 'postgres://u:p@localhost:5433/db', APP_ORIGIN: 'http://localhost:5173' };

describe('loadConfig', () => {
  it('applies defaults', () => {
    const c = loadConfig(base);
    expect(c.PORT).toBe(3000);
    expect(c.NODE_ENV).toBe('development');
    expect(c.cookieSecure).toBe(false);
    expect(c.catalogHosts).toEqual(['flibusta.is', 'static.flibusta.is']);
    expect(c.ai).toBeNull();
  });
  it('limits auth attempts to 5 per minute unless overridden', () => {
    expect(loadConfig(base).AUTH_RATE_LIMIT_PER_MIN).toBe(5);
    expect(loadConfig({ ...base, AUTH_RATE_LIMIT_PER_MIN: '1000' }).AUTH_RATE_LIMIT_PER_MIN).toBe(1000);
  });
  it('secure cookies by default in production', () => {
    expect(loadConfig({ ...base, NODE_ENV: 'production' }).cookieSecure).toBe(true);
  });
  it('enables AI only when all AI vars are set', () => {
    const c = loadConfig({ ...base, AI_BASE_URL: 'https://ai.test/v1', AI_API_KEY: 'k', AI_MODEL: 'm' });
    expect(c.ai).toEqual({ baseUrl: 'https://ai.test/v1', apiKey: 'k', model: 'm' });
  });
  it('throws a readable error on invalid env', () => {
    expect(() => loadConfig({ APP_ORIGIN: 'nope' })).toThrow(/Invalid environment/);
  });
});
