import { useSyncExternalStore } from 'react';

// 'storage-update' fires on every replica change (services.ts) and on local-only metadata changes (storage.ts).
let version = 0;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('storage-update', () => {
    version += 1;
    for (const listener of listeners) listener();
  });
}

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};
const getVersion = () => version;

/** A number that changes whenever locally stored library data changes. */
export function useStorageVersion(): number {
  return useSyncExternalStore(subscribe, getVersion);
}

/**
 * Caches `compute()` per storage version, so every caller sees the same result until data changes.
 * Pass the value of `useStorageVersion()`; the explicit argument keeps the dependency visible to the compiler.
 */
export function cachedByVersion<T>(compute: () => T): (version: number) => T {
  let cache: { version: number; value: T } | null = null;
  return (v) => {
    if (cache?.version !== v) cache = { version: v, value: compute() };
    return cache.value;
  };
}
