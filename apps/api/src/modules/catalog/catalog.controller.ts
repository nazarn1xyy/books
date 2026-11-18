import { Hono } from 'hono';
import { catalogBookParamsSchema, catalogImageQuerySchema, catalogSearchQuerySchema } from '@libify/shared';
import { parseWith, type AppEnv, type Controller } from '../../core/http';
import type { CatalogService } from './catalog.service';

/**
 * Streams an upstream response from our own origin. Upstream content is untrusted, so browsers
 * must neither sniff nor execute it. Content-Length is forwarded only for unencoded bodies:
 * fetch() decodes gzip/br, so an encoded body's length no longer matches what we stream.
 */
const passthrough = (upstream: Response, cacheControl: string, extra: Record<string, string> = {}): Response => {
  const headers = new Headers({
    'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
    'Cache-Control': cacheControl,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    ...extra,
  });
  const length = upstream.headers.get('content-length');
  if (length && !upstream.headers.has('content-encoding')) headers.set('Content-Length', length);
  return new Response(upstream.body, { status: 200, headers });
};

export class CatalogController implements Controller {
  readonly basePath = '/catalog';
  readonly usesSession = false;

  constructor(private readonly catalog: CatalogService) {}

  routes(): Hono<AppEnv> {
    return new Hono<AppEnv>()
      .get('/search', async (c) => {
        const { q } = parseWith(catalogSearchQuerySchema, c.req.query());
        const xml = await this.catalog.searchOpds(q);
        return c.body(xml, 200, { 'Content-Type': 'application/atom+xml; charset=utf-8', 'Cache-Control': 'private, max-age=300' });
      })
      .get('/book/:id/:format', async (c) => {
        const { id, format } = parseWith(catalogBookParamsSchema, c.req.param());
        const upstream = await this.catalog.downloadBook(id, format);
        const disposition = upstream.headers.get('content-disposition') ?? `attachment; filename="${id}.${format}"`;
        return passthrough(upstream, 'private, max-age=86400', { 'Content-Disposition': disposition });
      })
      .get('/image', async (c) => {
        const { src } = parseWith(catalogImageQuerySchema, c.req.query());
        return passthrough(await this.catalog.image(src), 'public, max-age=604800');
      });
  }
}
