import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';

export type Database = PostgresJsDatabase<typeof schema>;
/** Either the root database or a transaction handle. */
export type DbExecutor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

export interface DatabaseHandle {
  db: Database;
  close(): Promise<void>;
}

export function createDatabase(url: string, maxConnections: number): DatabaseHandle {
  const client = postgres(url, { max: maxConnections, idle_timeout: 20, connect_timeout: 10, onnotice: () => {} });
  return { db: drizzle(client, { schema }), close: () => client.end({ timeout: 5 }) };
}
