import path from 'node:path';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDatabase } from '../src/core/db';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://libify:libify@localhost:5433/libify_test';

export default async function setup(): Promise<void> {
  process.env.TEST_DATABASE_URL = TEST_DATABASE_URL;
  const { db, close } = createDatabase(TEST_DATABASE_URL, 1);
  try {
    await db.execute(sql`drop schema if exists drizzle cascade`);
    await db.execute(sql`drop schema if exists public cascade`);
    await db.execute(sql`create schema public`);
    await migrate(db, { migrationsFolder: path.resolve(import.meta.dirname, '../drizzle') });
  } finally {
    await close();
  }
}
