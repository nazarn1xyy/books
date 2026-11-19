import { lazy, type ComponentType } from 'react';

const GUARD_KEY = 'libify.chunk-reload';
type GuardStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

// Leaving the page aborts in-flight module fetches; that failure is not a stale deploy.
// beforeunload may fire without an actual unload (cancelled prompt, download, external protocol),
// so it only marks a short window, never a permanent state.
const UNLOAD_WINDOW_MS = 3000;
const UNLOAD_GRACE_MS = 2000;
let unloadStartedAt = -Infinity;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    unloadStartedAt = Date.now();
  });
}
const pageUnloading = () => Date.now() - unloadStartedAt < UNLOAD_WINDOW_MS;

/**
 * A failed dynamic import after a deploy means our HTML references chunks that no longer exist.
 * Reload once to fetch the new HTML; a guard prevents reload loops.
 */
export async function loadWithReload<T>(
  importFn: () => Promise<T>,
  storage: GuardStorage = sessionStorage,
  reload: () => void = () => window.location.reload(),
  isUnloading: () => boolean = pageUnloading,
  unloadGraceMs: number = UNLOAD_GRACE_MS,
): Promise<T> {
  try {
    const mod = await importFn();
    storage.removeItem(GUARD_KEY);
    return mod;
  } catch (err) {
    // The page may be going away on its own; reloading now would hijack that navigation.
    // If we are still here after the grace period, it was not a real unload: handle it normally.
    if (isUnloading()) await new Promise((resolve) => setTimeout(resolve, unloadGraceMs));
    if (storage.getItem(GUARD_KEY)) throw err;
    storage.setItem(GUARD_KEY, '1');
    reload();
    return new Promise<T>(() => {}); // the page is going away
  }
}

export function lazyWithReload<C extends ComponentType<object>>(importFn: () => Promise<{ default: C }>) {
  return lazy(() => loadWithReload(importFn));
}
