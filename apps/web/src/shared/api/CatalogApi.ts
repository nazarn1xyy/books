import type { BookFormat } from '@libify/shared';
import type { ApiClient } from './ApiClient';

export const CATALOG_ORIGIN = 'https://flibusta.is';
const BOOK_DOWNLOAD_TIMEOUT_MS = 120_000;
/**
 * The API already retries Flibusta (3 attempts x 15 s per hop), so a cold search can take ~50 s.
 * Wait for it once instead of timing out early and re-sending the same slow request.
 */
const SEARCH_TIMEOUT_MS = 90_000;

/** Image URL proxied (and cached) by our API. Accepts absolute or OPDS-relative links. */
export function catalogImageUrl(href: string): string {
  return `/api/catalog/image?src=${encodeURIComponent(new URL(href, CATALOG_ORIGIN).toString())}`;
}

export class CatalogApi {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  searchOpds(query: string): Promise<string> {
    return this.client.getText(`/catalog/search?q=${encodeURIComponent(query)}`, {
      timeoutMs: SEARCH_TIMEOUT_MS,
      retries: 0,
    });
  }

  downloadBook(bookId: string, format: BookFormat = 'fb2'): Promise<ArrayBuffer> {
    return this.client.getArrayBuffer(`/catalog/book/${encodeURIComponent(bookId)}/${format}`, BOOK_DOWNLOAD_TIMEOUT_MS);
  }
}
