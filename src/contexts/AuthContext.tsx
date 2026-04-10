/**
 * AuthContext.tsx — .NET JWT Authentication
 *
 * Replaces Supabase Auth completely.  All auth calls hit the
 * ZenaTech SPLM .NET backend (/api/v1/auth/…).
 *
 * Token storage: localStorage under key 'zenatech_jwt'.
 * The `user` and `profile` shapes are kept compatible with what
 * existing components expect so no component edits are required.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
const TOKEN_KEY = 'zenatech_jwt';

// ── Types ──────────────────────────────────────────────────────────────────────

/** Minimal user object that mirrors the .NET AuthResponse. */
export interface NetUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

interface AuthContextType {
  /** Current authenticated user (null when logged out). */
  user: NetUser | null;
  /** Compatibility shim — exposes access_token for code that reads session.access_token. */
  session: { access_token: string } | null;
  profile: UserProfile | null;
  userRole: string;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  can: (permission: string) => boolean;
}

// ── RBAC ───────────────────────────────────────────────────────────────────────

const ROLES: Record<string, string[]> = {
  admin:     ['read', 'edit', 'config', 'users', 'reports', 'assign', 'override', 'deploy', 'release'],
  manager:   ['read', 'edit', 'reports', 'assign', 'override', 'deploy', 'release'],
  developer: ['read', 'reports', 'deploy'],
  viewer:    ['read'],
};

// ── Token helpers ─────────────────────────────────────────────────────────────

function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function saveToken(t: string): void {
  try { localStorage.setItem(TOKEN_KEY, t); } catch {}
}
function clearToken(): void {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

// ── API helper ────────────────────────────────────────────────────────────────

async function authFetch<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_BASE}/api/v1${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as Record<string, unknown>));
    const fromErrors =
      Array.isArray(body?.errors) ? (body.errors as string[]).filter(Boolean).join(' ') : '';
    const msg =
      (body?.detail as string | undefined) ||
      (body?.message as string | undefined) ||
      (body?.title as string | undefined) ||
      fromErrors ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<NetUser | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  /** Apply a successful auth response to all state slices. */
  const applyAuth = (token: string, userId: string, email: string, name: string, role: string) => {
    const netUser: NetUser = { id: userId, email, name, role };
    const userProfile: UserProfile = { id: userId, user_id: userId, name, email, role, active: true };
    setUser(netUser);
    setSession({ access_token: token });
    setProfile(userProfile);
    saveToken(token);
  };

  // ── Restore session on mount ─────────────────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }

    authFetch<{ user_id: string; name: string; email: string; role: string; active: boolean }>(
      '/auth/me', {}, token,
    )
      .then(me => applyAuth(token, me.user_id, me.email, me.name, me.role))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const userRole = profile?.role ?? 'viewer';
  const can = (permission: string) => ROLES[userRole]?.includes(permission) ?? false;

  // ── Sign in ──────────────────────────────────────────────────────────────────
  const signIn = async (email: string, password: string) => {
    const data = await authFetch<{
      token: string; user_id: string; email: string; name: string; role: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    applyAuth(data.token, data.user_id, data.email, data.name, data.role);
  };

  // ── Sign up — creates auth.users + dbo.profiles (role viewer), returns JWT ───
  const signUp = async (email: string, password: string, name: string) => {
    const data = await authFetch<{
      token: string; user_id: string; email: string; name: string; role: string;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    applyAuth(data.token, data.user_id, data.email, data.name, data.role);
  };

  // ── Sign out ─────────────────────────────────────────────────────────────────
  const signOut = async () => {
    clearToken();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, userRole, loading, signIn, signUp, signOut, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
