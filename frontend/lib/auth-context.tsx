'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from './api';

export type User = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  plan: string;
  videosUsedThisMonth: number;
  createdAt: string;
  stripeCustomerId?: string | null;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: string | null;
};

type AuthResponse = { user: User; accessToken: string };

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'clipforge_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const router = useRouter();

  React.useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setIsLoading(false);
      return;
    }

    apiFetch<User>('/auth/me', { token: stored })
      .then((me) => {
        setUser(me);
        setToken(stored);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const applyAuth = (data: AuthResponse) => {
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    setToken(data.accessToken);
    setUser(data.user);
  };

  const login = async (email: string, password: string) => {
    const data = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    applyAuth(data);
  };

  const register = async (name: string, email: string, password: string) => {
    const data = await apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: { name, email, password },
    });
    applyAuth(data);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setToken(null);
    router.push('/login');
  };

  const refreshUser = async () => {
    if (!token) return;
    const me = await apiFetch<User>('/auth/me', { token });
    setUser(me);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export { ApiError };
