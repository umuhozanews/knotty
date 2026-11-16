import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { type ApiUser, getCurrentUser, signIn as supabaseSignIn, signOut as supabaseSignOut } from '../lib/api';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'unavailable';
type AuthContextValue = {
  status: AuthStatus;
  user: ApiUser | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  retry: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<ApiUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const restoreSession = useCallback(async () => {
    setStatus('loading');
    setError(null);
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured for this build.');
      setStatus('unavailable');
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setError('Supabase could not be initialized.');
      setStatus('unavailable');
      return;
    }
    try {
      const { data, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session) {
        setUser(null);
        setStatus('signedOut');
        return;
      }
      setUser(await getCurrentUser());
      setStatus('signedIn');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to check your Supabase session.');
      setStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      void restoreSession();
      return;
    }

    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (!session || event === 'SIGNED_OUT') {
        setUser(null);
        setError(null);
        setStatus('signedOut');
      } else if (event === 'SIGNED_IN') {
        // Defer data requests until the auth callback releases Supabase's lock.
        setTimeout(() => {
          void getCurrentUser().then((account) => {
            setUser(account);
            setError(null);
            setStatus('signedIn');
          }).catch((cause) => {
            setError(cause instanceof Error ? cause.message : 'Unable to load your account.');
            setStatus('unavailable');
          });
        }, 0);
      }
    });

    void restoreSession();
    return () => subscription.unsubscribe();
  }, [restoreSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const account = await supabaseSignIn(email, password);
    setUser(account);
    setError(null);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabaseSignOut();
    } finally {
      setUser(null);
      setError(null);
      setStatus('signedOut');
    }
  }, []);

  const value = useMemo(() => ({ status, user, error, signIn, signOut, retry: restoreSession }), [status, user, error, signIn, signOut, restoreSession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
