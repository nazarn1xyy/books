import type { SyncSignals } from './SyncEngine';

export const browserSyncSignals: SyncSignals = {
  subscribe(trigger) {
    const onOnline = () => trigger();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') trigger();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  },
};
