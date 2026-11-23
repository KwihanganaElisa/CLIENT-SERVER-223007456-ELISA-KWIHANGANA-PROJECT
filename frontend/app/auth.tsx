'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SESSION_KEY = 'invoice-app.supabase-session';

export type AuthUser = {
  id: string;
  email?: string;
  app_metadata?: { role?: string };
};

type Session = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  user: AuthUser;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function authHeaders(token?: string) {
  return {
    apikey: SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseAuthResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.msg || payload.error_description || payload.message || 'Authentication failed.');
  }
  return payload;
}

function withExpiry(session: Session): Session {
  if (!session.expires_at && session.expires_in) {
    return { ...session, expires_at: Math.floor(Date.now() / 1000) + session.expires_in };
  }
  return session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const saveSession = useCallback((next: Session | null) => {
    const normalized = next ? withExpiry(next) : null;
    setSessionState(normalized);
    if (normalized) localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
    else localStorage.removeItem(SESSION_KEY);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) setSessionState(JSON.parse(stored));
    } catch {
      localStorage.removeItem(SESSION_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSession = useCallback(async (current: Session) => {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ refresh_token: current.refresh_token }),
    });
    const next = (await parseAuthResponse(response)) as Session;
    saveSession(next);
    return withExpiry(next);
  }, [saveSession]);

  const getAccessToken = useCallback(async () => {
    if (!session) return null;
    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at && session.expires_at <= now + 30) {
      try {
        return (await refreshSession(session)).access_token;
      } catch {
        saveSession(null);
        return null;
      }
    }
    return session.access_token;
  }, [refreshSession, saveSession, session]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase is not configured.');
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ email, password }),
    });
    saveSession((await parseAuthResponse(response)) as Session);
  }, [saveSession]);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase is not configured.');
    const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ email, password }),
    });
    const result = await parseAuthResponse(response);
    if (result.access_token) saveSession(result as Session);
    return { needsConfirmation: !result.access_token };
  }, [saveSession]);

  const signOut = useCallback(async () => {
    if (session?.access_token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: authHeaders(session.access_token),
      }).catch(() => undefined);
    }
    saveSession(null);
  }, [saveSession, session]);

  const value = useMemo(() => ({
    user: session?.user ?? null,
    loading,
    signIn,
    signUp,
    signOut,
    getAccessToken,
  }), [getAccessToken, loading, session?.user, signIn, signOut, signUp]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
