'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, setAccessToken, clearTokens, getAccessToken } from '@/lib/api-client';

interface AdminUser {
  userId: string;
  role: string;
}

interface AuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Decodes the JWT payload client-side purely to read { sub, role } for
// display/guarding — this is NOT a verification step. The backend is the
// only party that verifies the signature; the frontend just needs to know
// who's "probably" logged in to decide what to render.
function decodeJwtPayload(token: string): { sub: string; role: string } | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const tokens = await api.post<{ accessToken: string }>('/api/auth/refresh');
        if (!mounted) return;
        setAccessToken(tokens.accessToken);
        const payload = decodeJwtPayload(tokens.accessToken);
        if (payload) setUser({ userId: payload.sub, role: payload.role });
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function login(email: string, password: string) {
    const tokens = await api.post<{ accessToken: string }>('/api/auth/login', {
      email,
      password,
    }, { 'X-Use-HttpOnly-Refresh-Cookie': 'true' });
    const payload = decodeJwtPayload(tokens.accessToken);
    if (!payload || payload.role !== 'ADMIN') {
      throw new Error('This account is not an admin account.');
    }
    setAccessToken(tokens.accessToken);
    setUser({ userId: payload.sub, role: payload.role });
    router.push('/overview');
  }

  function logout() {
    void api.post('/api/auth/logout').catch(() => undefined);
    clearTokens();
    setUser(null);
    router.push('/login');
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
