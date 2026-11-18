import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CatalogClient } from '../src/modules/catalog/catalog.client';
import { createTestContext } from './helpers';

type Handler = (url: URL) => Response | Promise<Response>;
let handler: Handler = () => new Response('not set', { status: 500 });
const calls: string[] = [];
let lastSignal: AbortSignal | undefined;
const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input));
  calls.push(url.toString());
  lastSignal = init?.signal ?? undefined;
  return handler(url);
}) as typeof fetch;

const ctx = await createTestContext({ fetch: fakeFetch });
afterAll(() => ctx.close());
beforeEach(() => {
  calls.length = 0;
});

describe('CatalogClient', () => {
  const client = new CatalogClient(['flibusta.is'], fakeFetch, 1_000, 2, 0);

  it('refuses hosts outside the allow-list', async () => {
    await expect(client.get(new URL('http://169.254.169.254/latest'))).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(calls).toEqual([]);
  });

  it('refuses non-default ports on allowed hosts', async () => {
    await expect(client.get(new URL('https://flibusta.is:8443/opds'))).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(client.get(new URL('http://flibusta.is:22/x'))).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(calls).toEqual([]);
  });

  it('accepts an explicit default port', async () => {
    handler = () => new Response('ok');
    await expect(client.get(new URL('https://flibusta.is:443/opds'))).resolves.toBeInstanceOf(Response);
  });

  it('refuses redirects to foreign hosts', async () => {
    handler = () => new Response(null, { status: 302, headers: { location: 'http://evil.test/x' } });
    await expect(client.get(new URL('https://flibusta.is/b/1/fb2'))).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('does not abort the body stream once headers have arrived', async () => {
    handler = () => new Response('ok');
    await new CatalogClient(['flibusta.is'], fakeFetch, 20, 0, 0).get(new URL('https://flibusta.is/b/1/fb2'));
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(lastSignal?.aborted).toBe(false);
  });

  it('retries on 5xx and then succeeds', async () => {
    let n = 0;
    handler = () => (++n < 3 ? new Response('down', { status: 503 }) : new Response('ok'));
    const res = await client.get(new URL('https://flibusta.is/opds'));
    expect(await res.text()).toBe('ok');
    expect(calls).toHaveLength(3);
  });
});

describe('catalog routes', () => {
  it('proxies OPDS search and caches it', async () => {
    handler = () => new Response('<feed/>', { headers: { 'content-type': 'application/atom+xml' } });
    const first = await ctx.client().get('/api/catalog/search?q=Tolstoy');
    expect(first.status).toBe(200);
    expect(await first.text()).toBe('<feed/>');
    expect(calls[0]).toBe('https://flibusta.is/opds/search?searchType=books&searchTerm=Tolstoy');
    await ctx.client().get('/api/catalog/search?q=tolstoy');
    expect(calls).toHaveLength(1);
  });

  it('streams a book download', async () => {
    handler = () => new Response('BOOK', { headers: { 'content-type': 'application/zip' } });
    const res = await ctx.client().get('/api/catalog/book/123/fb2');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(await res.text()).toBe('BOOK');
  });

  it('does not forward Content-Length of an encoded upstream body', async () => {
    handler = () =>
      new Response('BOOK', { headers: { 'content-type': 'application/zip', 'content-encoding': 'gzip', 'content-length': '2' } });
    const res = await ctx.client().get('/api/catalog/book/124/fb2');
    expect(res.headers.get('content-length')).not.toBe('2');
    expect(await res.text()).toBe('BOOK');
  });

  it('marks proxied files as non-sniffable and sandboxed', async () => {
    handler = () => new Response('BOOK', { headers: { 'content-type': 'text/html' } });
    const res = await ctx.client().get('/api/catalog/book/125/fb2');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-security-policy')).toMatch(/sandbox/);
    expect(res.headers.get('content-disposition')).toMatch(/attachment/);
  });

  it('rejects non-image upstream content on the image route', async () => {
    handler = () => new Response('<script>', { headers: { 'content-type': 'text/html' } });
    const res = await ctx.client().get(`/api/catalog/image?src=${encodeURIComponent('https://static.flibusta.is/i/2/x.jpg')}`);
    expect(res.status).toBe(502);
  });

  it('validates book id and format', async () => {
    expect((await ctx.client().get('/api/catalog/book/abc/fb2')).status).toBe(400);
    expect((await ctx.client().get('/api/catalog/book/1/exe')).status).toBe(400);
  });

  it('serves images only from allowed hosts and with image extensions', async () => {
    handler = () => new Response('IMG', { headers: { 'content-type': 'image/jpeg' } });
    const ok = await ctx.client().get(`/api/catalog/image?src=${encodeURIComponent('https://static.flibusta.is/i/1/cover.jpg')}`);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toMatch(/max-age=604800/);
    const foreign = await ctx.client().get(`/api/catalog/image?src=${encodeURIComponent('https://evil.test/a.jpg')}`);
    expect(foreign.status).toBe(400);
    const notImage = await ctx.client().get(`/api/catalog/image?src=${encodeURIComponent('https://flibusta.is/b/1/fb2')}`);
    expect(notImage.status).toBe(400);
  });

  it('maps upstream 404 to NOT_FOUND', async () => {
    handler = () => new Response('nope', { status: 404 });
    const res = await ctx.client().get('/api/catalog/book/5/epub');
    expect(res.status).toBe(404);
  });
});
