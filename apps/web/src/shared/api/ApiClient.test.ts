import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from './ApiClient';
import { ApiError } from './ApiError';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('ApiClient', () => {
  it('prefixes /api, sends JSON and parses the response', async () => {
    const fetchFn = vi.fn(async () => json({ ok: true }));
    const client = new ApiClient({ fetchFn });
    expect(await client.post('/auth/login', { a: 1 })).toEqual({ ok: true });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/auth/login');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    expect(init.body).toBe('{"a":1}');
  });

  it('returns undefined for 204', async () => {
    const client = new ApiClient({ fetchFn: async () => new Response(null, { status: 204 }) });
    expect(await client.post('/auth/logout')).toBeUndefined();
  });

  it('maps the uniform error body to ApiError', async () => {
    const client = new ApiClient({
      fetchFn: async () => json({ error: { code: 'NICKNAME_TAKEN', message: 'taken' } }, 409),
    });
    await expect(client.post('/auth/register', {})).rejects.toMatchObject({ code: 'NICKNAME_TAKEN', status: 409 });
  });

  it('retries GET on network failure and 5xx, never retries POST', async () => {
    let calls = 0;
    const flaky = new ApiClient({
      retryDelayMs: 0,
      fetchFn: async () => {
        calls += 1;
        if (calls === 1) throw new TypeError('Failed to fetch');
        if (calls === 2) return json({ error: { code: 'INTERNAL', message: 'x' } }, 500);
        return json({ ok: 1 });
      },
    });
    expect(await flaky.get('/sync/pull')).toEqual({ ok: 1 });
    expect(calls).toBe(3);

    let postCalls = 0;
    const post = new ApiClient({
      retryDelayMs: 0,
      fetchFn: async () => {
        postCalls += 1;
        throw new TypeError('Failed to fetch');
      },
    });
    await expect(post.post('/sync/push', {})).rejects.toMatchObject({ code: 'NETWORK' });
    expect(postCalls).toBe(1);
  });

  it('lets a GET opt out of retries and use its own timeout', async () => {
    let calls = 0;
    const client = new ApiClient({
      retryDelayMs: 0,
      timeoutMs: 1,
      fetchFn: async (_input, init) => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        if (init?.signal?.aborted) throw new DOMException('timed out', 'TimeoutError');
        return new Response('<feed/>');
      },
    });
    expect(await client.getText('/catalog/search?q=x', { timeoutMs: 1_000, retries: 0 })).toBe('<feed/>');
    await expect(client.getText('/catalog/search?q=x', { retries: 0 })).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(calls).toBe(2);
  });

  it('notifies the unauthorized listener on UNAUTHORIZED', async () => {
    const client = new ApiClient({ fetchFn: async () => json({ error: { code: 'UNAUTHORIZED', message: 'x' } }, 401) });
    const listener = vi.fn();
    client.onUnauthorized(listener);
    await expect(client.get('/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('reads binary bodies', async () => {
    const client = new ApiClient({ fetchFn: async () => new Response(new Uint8Array([1, 2, 3])) });
    const buf = await client.getArrayBuffer('/catalog/book/1/fb2');
    expect(new Uint8Array(buf)).toEqual(new Uint8Array([1, 2, 3]));
  });
});
