import type { BookFormat } from '@libify/shared';
import type { ApiClient } from './ApiClient';

export const CATALOG_ORIGIN = 'https://flibusta.is';
const BOOK_DOWNLOAD_TIMEOUT_MS = 120_000;

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
    return this.client.getText(`/catalog/search?q=${encodeURIComponent(query)}`);
  }

  downloadBook(bookId: string, format: BookFormat = 'fb2'): Promise<ArrayBuffer> {
    return this.client.getArrayBuffer(`/catalog/book/${encodeURIComponent(bookId)}/${format}`, BOOK_DOWNLOAD_TIMEOUT_MS);
  }
}
