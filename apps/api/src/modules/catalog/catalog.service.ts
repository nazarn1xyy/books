import { LRUCache } from 'lru-cache';
import type { BookFormat } from '@libify/shared';
import { NotFoundError, UpstreamError, ValidationError } from '../../core/errors';
import type { CatalogClient } from './catalog.client';

const IMAGE_PATH = /\.(jpe?g|png|gif|webp)$/i;

export class CatalogService {
  private readonly searchCache = new LRUCache<string, string>({
    max: 200,
    ttl: 10 * 60_000,
    maxSize: 10 * 1024 * 1024,
    sizeCalculation: (xml) => Math.max(1, xml.length),
  });

  constructor(
    private readonly client: CatalogClient,
    private readonly baseUrl: URL,
  ) {}

  async searchOpds(term: string): Promise<string> {
    const cacheKey = term.trim().toLowerCase();
    const cached = this.searchCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const url = new URL('/opds/search', this.baseUrl);
    url.searchParams.set('searchType', 'books');
    url.searchParams.set('searchTerm', term.trim());
    const xml = await (await this.ensureOk(await this.client.get(url))).text();
    this.searchCache.set(cacheKey, xml);
    return xml;
  }

  async downloadBook(bookId: string, format: BookFormat): Promise<Response> {
    return this.ensureOk(await this.client.get(new URL(`/b/${bookId}/${format}`, this.baseUrl)));
  }

  async image(src: string): Promise<Response> {
    let url: URL;
    try {
      url = new URL(src, this.baseUrl);
    } catch {
      throw new ValidationError('Invalid image URL');
    }
    if (!IMAGE_PATH.test(url.pathname)) throw new ValidationError('Not an image path');
    const res = this.ensureOk(await this.client.get(url));
    if (!res.headers.get('content-type')?.startsWith('image/')) {
      await res.body?.cancel();
      throw new UpstreamError('Catalog returned a non-image response');
    }
    return res;
  }

  private ensureOk(res: Response): Response {
    if (res.ok) return res;
    res.body?.cancel().catch(() => {});
    if (res.status === 404) throw new NotFoundError('Not found in catalog');
    throw new UpstreamError(`Catalog responded ${res.status}`);
  }
}
