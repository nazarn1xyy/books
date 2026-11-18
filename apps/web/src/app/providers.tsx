import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/features/auth';
import { LanguageProvider } from '@/shared/i18n/LanguageContext';
import { queryClient } from './queryClient';

const persister = createSyncStoragePersister({ storage: window.localStorage, key: 'libify.query-cache' });
const clearQueryCache = () => queryClient.clear();

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000,
        // Only catalog results are worth persisting; admin stats must be fresh.
        dehydrateOptions: { shouldDehydrateQuery: (q) => q.queryKey[0] === 'catalog' && q.state.status === 'success' },
      }}
    >
      <LanguageProvider>
        <AuthProvider onSignOut={clearQueryCache}>{children}</AuthProvider>
      </LanguageProvider>
    </PersistQueryClientProvider>
  );
}
