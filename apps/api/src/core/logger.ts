import { pino, type Logger } from 'pino';
import type { Config } from './config';

export type { Logger };

export function createLogger(config: Pick<Config, 'LOG_LEVEL' | 'NODE_ENV'>): Logger {
  return pino({
    level: config.LOG_LEVEL,
    ...(config.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
  });
}
