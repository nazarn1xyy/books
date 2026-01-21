import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { syncData } from '../utils/sync';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string) => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        // Check active sessions and sets the user
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
            if (session?.user) {
                syncData(session.user.id);
            }
        });

        // Listen for changes on auth state (logged in, signed out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
            if (session?.user) {
                syncData(session.user.id);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Realtime Sync Subscription
    useEffect(() => {
        if (!user) return;

        let syncTimeout: NodeJS.Timeout;
        const debouncedSync = () => {
            clearTimeout(syncTimeout);
            syncTimeout = setTimeout(() => {
                console.log('Realtime update detected, syncing...');
                syncData(user.id).then(() => {
                    // Force refresh UI by reloading window? No, React state should handle it.
                    // But syncData updates local storage, not React state directly.
                    // We need to trigger a window event or use a state manager.
                    // Since existing components read from storage on mount or use events?
                    // MyBooks uses `useState(getMyBookIds())`. It doesn't listen to storage.
                    // We need to dispatch a custom event 'storage-update'.
                    window.dispatchEvent(new Event('storage-update'));
                });
            }, 1000); // Wait 1s for batch updates
        };

        const channel = supabase
            .channel('db-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_books',
                    filter: `user_id=eq.${user.id}`,
                },
                (_payload) => {
                    debouncedSync();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const signIn = async (_email: string) => {
        // Placeholder as actual sign in is handled in Auth page
        return Promise.resolve();
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    const value = {
        user,
        session,
        loading,
        signIn,
        signOut,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
