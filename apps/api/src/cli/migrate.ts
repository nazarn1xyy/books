import path from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDatabase } from '../core/db';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

const migrationsFolder = process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), 'drizzle');
const { db, close } = createDatabase(url, 1);
try {
  await migrate(db, { migrationsFolder });
  console.log(`Migrations applied from ${migrationsFolder}`);
} finally {
  await close();
}
