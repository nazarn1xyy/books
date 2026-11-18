import type { ErrorCode } from '@libify/shared';

export type ApiErrorCode = ErrorCode | 'NETWORK' | 'TIMEOUT';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }

  /** The request never got an HTTP answer (offline, DNS, timeout). */
  get isNetwork(): boolean {
    return this.code === 'NETWORK' || this.code === 'TIMEOUT';
  }
}
