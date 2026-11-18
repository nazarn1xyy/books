import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context, Hono } from 'hono';
import type { RequestIdVariables } from 'hono/request-id';
import { z } from 'zod';
import type { PublicUser } from '@libify/shared';
import { ValidationError } from './errors';

export type SessionUser = PublicUser & { sessionId: string };

export interface AppEnv {
  Variables: RequestIdVariables & { user: SessionUser | null };
}

/** A feature module's HTTP entry point. */
export interface Controller {
  readonly basePath: string;
  /** Whether the session middleware must run before this controller. */
  readonly usesSession: boolean;
  routes(): Hono<AppEnv>;
}

export async function readJson<S extends z.ZodType>(c: Context, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ValidationError('Body must be valid JSON');
  }
  return parseWith(schema, raw);
}

export function parseWith<S extends z.ZodType>(schema: S, raw: unknown): z.infer<S> {
  const result = schema.safeParse(raw);
  if (!result.success) throw new ValidationError(z.prettifyError(result.error));
  return result.data;
}

/** Caddy is the only client of the API and overwrites X-Forwarded-For, so it is trusted. */
export function clientIp(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export function currentUser(c: Context<AppEnv>): SessionUser {
  const user = c.get('user');
  if (!user) throw new Error('currentUser() used on a route without requireAuth');
  return user;
}
