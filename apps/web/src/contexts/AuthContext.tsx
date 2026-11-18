/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Credentials, LoginInput, PublicUser } from '@libify/shared';
import { services } from '../shared/services';
import { importLegacyState } from '../shared/sync/legacyImport';
import { useLanguage } from './LanguageContext';

interface AuthContextType {
  user: PublicUser | null;
  loading: boolean;
  login(input: LoginInput): Promise<void>;
  register(input: Credentials): Promise<void>;
  /**
   * Returns 'unsynced' (and stays logged in) when local changes could not reach the server,
   * unless discardUnsynced is set.
   */
  signOut(options?: { discardUnsynced?: boolean }): Promise<'done' | 'unsynced'>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const USER_CACHE_KEY = 'libify.user';

function readCachedUser(): PublicUser | null {
  try {
    return JSON.parse(localStorage.getItem(USER_CACHE_KEY) ?? 'null') as PublicUser | null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: PublicUser | null): void {
  if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_CACHE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const svc = useMemo(() => services(), []);
  // Cached user lets the app open offline; /auth/me confirms or clears it.
  const [user, setUser] = useState<PublicUser | null>(readCachedUser);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();
  // Read through a ref so a language switch does not restart sync.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const applyUser = useCallback((next: PublicUser | null) => {
    writeCachedUser(next);
    setUser(next);
  }, []);

  useEffect(() => {
    svc.api.onUnauthorized(() => applyUser(null));
    return () => svc.api.onUnauthorized(null);
  }, [svc, applyUser]);

  useEffect(() => {
    let cancelled = false;
    svc.auth
      .me()
      .then((me) => {
        if (!cancelled) applyUser(me);
      })
      .catch((err) => console.warn('[auth] offline, using cached user', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [svc, applyUser]);

  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    svc.sync
      .start(userId)
      .then(() =>
        importLegacyState(svc.sync, svc.meta, userId, (count) =>
          window.confirm(tRef.current('auth.importLegacyLibrary', { count })),
        ),
      )
      .catch((err) => console.error('[sync] start failed', err));
    return () => svc.sync.stop();
  }, [svc, userId]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      login: async (input) => applyUser(await svc.auth.login(input)),
      register: async (input) => applyUser(await svc.auth.register(input)),
      signOut: async (options) => {
        await svc.sync.syncNow().catch(() => {}); // send pending changes first
        if (!options?.discardUnsynced && (await svc.sync.pendingCount()) > 0) return 'unsynced';
        await svc.auth.logout().catch(() => {});
        svc.sync.stop();
        await svc.sync.resetLocalData();
        applyUser(null);
        return 'done';
      },
    }),
    [user, loading, svc, applyUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
