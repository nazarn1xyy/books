import { afterAll, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from './helpers';

const aiFetch = (async (_input: string | URL | Request, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body));
  return Response.json({ choices: [{ message: { content: `summary of ${body.messages[1].content}` } }] });
}) as typeof fetch;

const disabled = await createTestContext();
const enabled: TestContext = await createTestContext({
  fetch: aiFetch,
  env: { AI_BASE_URL: 'https://ai.test/v1', AI_API_KEY: 'k', AI_MODEL: 'm' },
});
afterAll(async () => {
  await disabled.close();
  await enabled.close();
});

async function loggedIn(ctx: TestContext) {
  const client = ctx.client();
  await client.post('/api/auth/register', { nickname: `ai_${Math.random().toString(36).slice(2, 8)}`, password: 'password1' });
  return client;
}

describe('ai', () => {
  it('reports status', async () => {
    expect(await (await disabled.client().get('/api/ai/status')).json()).toEqual({ enabled: false });
    expect(await (await enabled.client().get('/api/ai/status')).json()).toEqual({ enabled: true });
  });
  it('requires auth to summarize', async () => {
    expect((await enabled.client().post('/api/ai/summarize', { text: 'x' })).status).toBe(401);
  });
  it('returns 503 AI_DISABLED when not configured', async () => {
    const res = await (await loggedIn(disabled)).post('/api/ai/summarize', { text: 'hello' });
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('AI_DISABLED');
  });
  it('summarizes via the configured provider', async () => {
    const res = await (await loggedIn(enabled)).post('/api/ai/summarize', { text: 'chapter' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ summary: 'summary of chapter' });
  });
});
