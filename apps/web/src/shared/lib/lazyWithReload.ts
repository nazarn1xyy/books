import { lazy, type ComponentType } from 'react';

const GUARD_KEY = 'libify.chunk-reload';
type GuardStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

// Leaving the page aborts in-flight module fetches; that failure is not a stale deploy.
let pageUnloading = false;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    pageUnloading = true;
  });
  window.addEventListener('pageshow', () => {
    pageUnloading = false; // back/forward cache restore, or the unload was cancelled
  });
}

/**
 * A failed dynamic import after a deploy means our HTML references chunks that no longer exist.
 * Reload once to fetch the new HTML; a guard prevents reload loops.
 */
export async function loadWithReload<T>(
  importFn: () => Promise<T>,
  storage: GuardStorage = sessionStorage,
  reload: () => void = () => window.location.reload(),
  isUnloading: () => boolean = () => pageUnloading,
): Promise<T> {
  try {
    const mod = await importFn();
    storage.removeItem(GUARD_KEY);
    return mod;
  } catch (err) {
    // The page is going away on its own; reloading would hijack that navigation.
    if (isUnloading()) return new Promise<T>(() => {});
    if (storage.getItem(GUARD_KEY)) throw err;
    storage.setItem(GUARD_KEY, '1');
    reload();
    return new Promise<T>(() => {}); // the page is going away
  }
}

export function lazyWithReload<C extends ComponentType<object>>(importFn: () => Promise<{ default: C }>) {
  return lazy(() => loadWithReload(importFn));
}
