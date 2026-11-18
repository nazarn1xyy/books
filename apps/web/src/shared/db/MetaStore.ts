import type { LibifyDatabase } from './libifyDb';

export class MetaStore {
  private readonly db: LibifyDatabase;

  constructor(db: LibifyDatabase) {
    this.db = db;
  }

  async get<T>(key: string): Promise<T | undefined> {
    return (await this.db.get('meta', key)) as T | undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.db.put('meta', value, key);
  }

  async delete(key: string): Promise<void> {
    await this.db.delete('meta', key);
  }
}
