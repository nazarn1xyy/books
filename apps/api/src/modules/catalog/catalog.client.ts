import { UpstreamError, ValidationError } from '../../core/errors';

/** Fetches only from allow-listed hosts; follows redirects manually to re-check every hop. */
export class CatalogClient {
  private static readonly MAX_REDIRECTS = 3;
  private static readonly USER_AGENT = 'LibifyBot/2.0 (+https://libify.store)';

  constructor(
    private readonly allowedHosts: readonly string[],
    private readonly fetchFn: typeof fetch,
    private readonly timeoutMs = 30_000,
    private readonly retries = 1,
    private readonly backoffMs = 500,
  ) {}

  async get(url: URL): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const res = await this.fetchFollowingRedirects(url);
        if (res.status >= 500) {
          await res.body?.cancel();
          throw new UpstreamError(`Catalog responded ${res.status}`);
        }
        return res;
      } catch (err) {
        if (err instanceof ValidationError) throw err;
        lastError = err;
        if (attempt < this.retries) await sleep(this.backoffMs * 2 ** attempt);
      }
    }
    throw new UpstreamError(`Catalog unavailable: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  }

  private async fetchFollowingRedirects(start: URL): Promise<Response> {
    let url = start;
    for (let hop = 0; hop <= CatalogClient.MAX_REDIRECTS; hop++) {
      this.assertAllowed(url);
      const res = await this.fetchHeaders(url);
      const location = res.headers.get('location');
      if (res.status < 300 || res.status >= 400 || !location) return res;
      await res.body?.cancel();
      url = new URL(location, url);
    }
    throw new UpstreamError('Too many redirects');
  }

  /**
   * The timeout covers only the wait for response headers: the body of a book is streamed
   * to the client afterwards and may legitimately take longer than timeoutMs.
   */
  private async fetchHeaders(url: URL): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`Timed out after ${this.timeoutMs} ms`)), this.timeoutMs);
    try {
      return await this.fetchFn(url, {
        headers: { 'User-Agent': CatalogClient.USER_AGENT },
        redirect: 'manual',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private assertAllowed(url: URL): void {
    // URL normalises the scheme's default port to '', so any explicit port here is non-default.
    if (!['http:', 'https:'].includes(url.protocol) || url.port !== '' || !this.allowedHosts.includes(url.hostname)) {
      throw new ValidationError(`Host not allowed: ${url.host}`);
    }
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
