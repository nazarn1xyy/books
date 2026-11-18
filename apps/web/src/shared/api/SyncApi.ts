import type { SyncOp, SyncPullResponse, SyncPushResponse } from '@libify/shared';
import type { ApiClient } from './ApiClient';

export class SyncApi {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  push(ops: SyncOp[]): Promise<SyncPushResponse> {
    return this.client.post<SyncPushResponse>('/sync/push', { ops });
  }

  pull(since: string | null): Promise<SyncPullResponse> {
    return this.client.get<SyncPullResponse>(`/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ''}`);
  }
}
