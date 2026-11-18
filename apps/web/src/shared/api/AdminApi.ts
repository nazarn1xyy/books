import type { AdminStats } from '@libify/shared';
import type { ApiClient } from './ApiClient';

export class AdminApi {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  stats(): Promise<AdminStats> {
    return this.client.get<AdminStats>('/admin/stats');
  }
}
