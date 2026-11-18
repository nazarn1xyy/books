import { afterAll, describe, expect, it } from 'vitest';
import { createTestContext } from './helpers';

const ctx = await createTestContext();
afterAll(() => ctx.close());

describe('http core', () => {
  it('GET /api/health reports ok', async () => {
    const res = await ctx.client().get('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', db: 'ok' });
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });
  it('unknown route returns uniform 404 body', async () => {
    const res = await ctx.client().get('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });
  it('blocks state-changing requests without our Origin', async () => {
    const res = await ctx.client().withoutOrigin().post('/api/health', {});
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('FORBIDDEN');
  });
});
