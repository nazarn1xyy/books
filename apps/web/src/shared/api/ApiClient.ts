import type { ApiErrorBody } from '@libify/shared';
import { ApiError } from './ApiError';

export interface ApiClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  getRetries?: number;
  retryDelayMs?: number;
}

interface RequestOptions {
  body?: unknown;
  timeoutMs?: number;
}

/** Same-origin JSON client for /api with timeouts, GET retries and typed errors. */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly getRetries: number;
  private readonly retryDelayMs: number;
  private unauthorizedListener: (() => void) | null = null;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? '/api';
    this.fetchFn = options.fetchFn ?? ((input, init) => globalThis.fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.getRetries = options.getRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 400;
  }

  onUnauthorized(listener: (() => void) | null): void {
    this.unauthorizedListener = listener;
  }

  async get<T>(path: string): Promise<T> {
    return ApiClient.parseJson<T>(await this.request('GET', path, {}));
  }

  async post<T = void>(path: string, body?: unknown): Promise<T> {
    return ApiClient.parseJson<T>(await this.request('POST', path, { body }));
  }

  async getText(path: string): Promise<string> {
    return (await this.request('GET', path, {})).text();
  }

  async getArrayBuffer(path: string, timeoutMs?: number): Promise<ArrayBuffer> {
    return (await this.request('GET', path, { timeoutMs })).arrayBuffer();
  }

  private async request(method: 'GET' | 'POST', path: string, options: RequestOptions): Promise<Response> {
    const attempts = method === 'GET' ? this.getRetries + 1 : 1;
    let lastError: ApiError | null = null;

    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) await sleep(this.retryDelayMs * 2 ** (attempt - 1));
      let response: Response;
      try {
        response = await this.fetchFn(this.baseUrl + path, {
          method,
          credentials: 'same-origin',
          headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: AbortSignal.timeout(options.timeoutMs ?? this.timeoutMs),
        });
      } catch (err) {
        lastError = ApiClient.networkError(err);
        continue;
      }

      if (response.ok) return response;
      const error = await ApiClient.httpError(response);
      if (error.code === 'UNAUTHORIZED') this.unauthorizedListener?.();
      if (response.status >= 500) {
        lastError = error;
        continue;
      }
      throw error;
    }
    throw lastError ?? new ApiError('NETWORK', 0, 'Request failed');
  }

  private static async parseJson<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private static async httpError(response: Response): Promise<ApiError> {
    try {
      const body = (await response.json()) as Partial<ApiErrorBody>;
      if (body.error?.code) return new ApiError(body.error.code, response.status, body.error.message);
    } catch {
      // not our JSON error body
    }
    return new ApiError(response.status >= 500 ? 'INTERNAL' : 'VALIDATION_FAILED', response.status, response.statusText);
  }

  private static networkError(err: unknown): ApiError {
    const isTimeout = err instanceof DOMException && err.name === 'TimeoutError';
    return new ApiError(isTimeout ? 'TIMEOUT' : 'NETWORK', 0, err instanceof Error ? err.message : String(err));
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
