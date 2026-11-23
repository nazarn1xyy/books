import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { applyTheme, readThemeChoice, resolveTheme, THEME_KEY, type ThemeChoice } from './theme';

const media = () => window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = media();
  mq.addEventListener('change', cb);
  window.addEventListener('storage', cb);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener('change', cb);
    window.removeEventListener('storage', cb);
  };
}

export function useTheme() {
  const choice = useSyncExternalStore(subscribe, readThemeChoice);
  const systemDark = useSyncExternalStore(subscribe, () => media().matches);
  const resolved = resolveTheme(choice, systemDark);

  useEffect(() => applyTheme(resolved), [resolved]);

  const setChoice = useCallback((next: ThemeChoice) => {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // storage unavailable (private mode) — theme still applies for this session via notify
    }
    notify();
  }, []);

  return { choice, resolved, setChoice };
}
