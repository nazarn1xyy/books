// Zod-free constants: safe to import from the web bundle without pulling zod in.

export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'INVALID_CREDENTIALS',
  'FORBIDDEN',
  'NOT_FOUND',
  'NICKNAME_TAKEN',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'AI_DISABLED',
  'UPSTREAM_FAILED',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const NICKNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/;
export const PASSWORD_MIN_LENGTH = 8;

export const USER_ROLES = ['user', 'admin'] as const;
export const BOOK_STATUSES = ['reading', 'plan', 'finished', 'dropped'] as const;
export const BOOK_FORMATS = ['fb2', 'epub', 'mobi'] as const;
export const SYNC_ENTITIES = ['book', 'progress', 'quote', 'bookmark', 'favorite'] as const;
export const SYNC_PUSH_MAX_OPS = 200;
/**
 * Max serialized size of one push request. A batch of SYNC_PUSH_MAX_OPS long quotes can exceed it,
 * so clients must cap batches by both op count and byte size; a single op always fits.
 * The server answers 413 PAYLOAD_TOO_LARGE above this size.
 */
export const SYNC_PUSH_MAX_BYTES = 4 * 1024 * 1024;
