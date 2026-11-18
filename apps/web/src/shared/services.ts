import { AdminApi } from './api/AdminApi';
import { ApiClient } from './api/ApiClient';
import { AuthApi } from './api/AuthApi';
import { CatalogApi } from './api/CatalogApi';
import { SyncApi } from './api/SyncApi';
import { openLibifyDb } from './db/libifyDb';
import { MetaStore } from './db/MetaStore';
import { browserSyncSignals } from './sync/browserSignals';
import { Outbox } from './sync/Outbox';
import { ReplicaStore } from './sync/ReplicaStore';
import { SyncEngine } from './sync/SyncEngine';

export interface AppServices {
  api: ApiClient;
  auth: AuthApi;
  catalog: CatalogApi;
  admin: AdminApi;
  replica: ReplicaStore;
  meta: MetaStore;
  sync: SyncEngine;
}

let instance: AppServices | null = null;

/** Composition root. Must resolve before the React tree renders. */
export async function initServices(): Promise<AppServices> {
  if (instance) return instance;
  const db = await openLibifyDb();
  const api = new ApiClient();
  const replica = await ReplicaStore.load(db);
  const meta = new MetaStore(db);
  const sync = new SyncEngine({ api: new SyncApi(api), replica, outbox: new Outbox(db), meta, signals: browserSyncSignals });

  // Legacy pages listen for this event to re-read state.
  replica.subscribe(() => window.dispatchEvent(new Event('storage-update')));

  instance = { api, auth: new AuthApi(api), catalog: new CatalogApi(api), admin: new AdminApi(api), replica, meta, sync };
  return instance;
}

export function services(): AppServices {
  if (!instance) throw new Error('services() called before initServices() resolved');
  return instance;
}
