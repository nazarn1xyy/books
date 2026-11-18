import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ApiErrorBody, ErrorCode } from '@libify/shared';

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: ContentfulStatusCode,
    message: string,
    readonly headers: Readonly<Record<string, string>> = {},
  ) {
    super(message);
    this.name = new.target.name;
  }

  toBody(): ApiErrorBody {
    return { error: { code: this.code, message: this.message } };
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request') {
    super('VALIDATION_FAILED', 400, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', 401, message);
  }
}

export class InvalidCredentialsError extends AppError {
  constructor() {
    super('INVALID_CREDENTIALS', 401, 'Wrong nickname or password');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', 403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super('NOT_FOUND', 404, message);
  }
}

export class NicknameTakenError extends AppError {
  constructor() {
    super('NICKNAME_TAKEN', 409, 'This nickname is already taken');
  }
}

export class PayloadTooLargeError extends AppError {
  constructor() {
    super('PAYLOAD_TOO_LARGE', 413, 'Request body is too large');
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSec: number) {
    super('RATE_LIMITED', 429, 'Too many requests', { 'Retry-After': String(retryAfterSec) });
  }
}

export class UpstreamError extends AppError {
  constructor(message = 'Upstream service failed') {
    super('UPSTREAM_FAILED', 502, message);
  }
}

export class AiDisabledError extends AppError {
  constructor() {
    super('AI_DISABLED', 503, 'AI is not configured');
  }
}
