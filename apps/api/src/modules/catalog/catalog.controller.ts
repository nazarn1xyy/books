import { Hono } from 'hono';
import { catalogBookParamsSchema, catalogImageQuerySchema, catalogSearchQuerySchema } from '@libify/shared';
import { parseWith, type AppEnv, type Controller } from '../../core/http';
import type { CatalogService } from './catalog.service';

const passthrough = (upstream: Response, cacheControl: string, extra: string[] = []): Response => {
  const headers = new Headers({
    'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
    'Cache-Control': cacheControl,
  });
  for (const name of extra) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
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
        return passthrough(upstream, 'private, max-age=86400', ['content-disposition', 'content-length']);
      })
      .get('/image', async (c) => {
        const { src } = parseWith(catalogImageQuerySchema, c.req.query());
        return passthrough(await this.catalog.image(src), 'public, max-age=604800', ['content-length']);
      });
  }
}
