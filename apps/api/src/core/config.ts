import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  APP_ORIGIN: z.url(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  COOKIE_SECURE: z.stringbool().optional(),
  /** Auth attempts (login + register) per IP per minute. Raised only for local e2e runs. */
  AUTH_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(5),
  CATALOG_HOSTS: z.string().default('flibusta.is,static.flibusta.is'),
  AI_BASE_URL: z.url().optional(),
  AI_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().min(1).optional(),
});

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export type Config = z.infer<typeof envSchema> & {
  cookieSecure: boolean;
  catalogHosts: string[];
  ai: AiConfig | null;
};

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  const e = parsed.data;
  return {
    ...e,
    cookieSecure: e.COOKIE_SECURE ?? e.NODE_ENV === 'production',
    catalogHosts: e.CATALOG_HOSTS.split(',').map((h) => h.trim()).filter(Boolean),
    ai: e.AI_BASE_URL && e.AI_API_KEY && e.AI_MODEL ? { baseUrl: e.AI_BASE_URL, apiKey: e.AI_API_KEY, model: e.AI_MODEL } : null,
  };
}
