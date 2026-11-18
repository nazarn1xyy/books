import { sql } from 'drizzle-orm';
import type { Database } from '../../core/db';

export class HealthService {
  private static readonly DB_TIMEOUT_MS = 1_000;

  constructor(private readonly db: Database) {}

  async isDatabaseUp(): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.db.execute(sql`select 1`),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('db timeout')), HealthService.DB_TIMEOUT_MS);
        }),
      ]);
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
