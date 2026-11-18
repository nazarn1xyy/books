import { useSyncExternalStore } from 'react';
import { services } from '@/shared/services';

/** Re-renders the component whenever any synced record changes. */
export function useReplicaVersion(): number {
  const { replica } = services();
  return useSyncExternalStore(
    (onChange) => replica.subscribe(onChange),
    () => replica.getVersion(),
  );
}
