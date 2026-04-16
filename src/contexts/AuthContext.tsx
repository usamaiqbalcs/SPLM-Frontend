/**
 * AuthContext.tsx — .NET JWT + refresh rotation
 *
 * Short-lived access token + opaque refresh token (see `token-lifecycle.ts`).
 * Role/permissions follow DB hydration; `refreshProfile()` syncs `/auth/me` for UX.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { normalizeRole, roleHasPermission, SplmRoles } from '@/constants/splm-rbac';
import {
  clearAllAuthTokens,
  getAccessToken,
  looksLikeAccessJwt,
  msUntilJwtExpiry,
  saveAccessToken,
  saveRefreshToken,
  tryRefreshAccessToken,
} from '@/lib/token-lifecycle';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

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

interface MeResponse {
  user_id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

interface MyPermissionsResponse {
  role: string;
  permissions: string[];
}

interface AuthTokensJson {
  /** OAuth2-style field from API (preferred). */
  access_token?: string;
  /** Legacy alias if present. */
  token?: string;
  refresh_token?: string;
  user_id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: NetUser | null;
  session: { access_token: string } | null;
  profile: UserProfile | null;
  userRole: string;
  normalizedRole: string;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  can: (permission: string) => boolean;
  refreshProfile: () => Promise<void>;
}

async function authFetch<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_BASE}/api/v1${path}`, { ...init, headers });
  if (!res.ok) {
    if (res.status === 403) {
      const body = await res.json().catch(() => ({} as Record<string, unknown>));
      const friendly =
        typeof body?.message === 'string' && body.message.trim()
          ? String(body.message).trim()
          : 'You do not have permission to perform this action.';
      throw new Error(friendly);
    }
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

async function fetchMe(token: string): Promise<MeResponse> {
  const trimmed = token.trim();
  const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${trimmed}`, Accept: 'application/json' },
  });
  if (res.status === 401 || res.status === 403) {
    const body = await res.json().catch(() => ({} as Record<string, unknown>));
    const fromErrors =
      Array.isArray(body?.errors) ? (body.errors as string[]).filter(Boolean).join(' ') : '';
    if (res.status === 403) {
      const friendly =
        typeof body?.message === 'string' && body.message.trim()
          ? String(body.message).trim()
          : 'You do not have permission to perform this action.';
      const err = new Error(friendly);
      (err as Error & { status?: number }).status = res.status;
      throw err;
    }
    const detail =
      (typeof body?.detail === 'string' && body.detail.trim()) ||
      (typeof body?.title === 'string' && body.title.trim()) ||
      fromErrors ||
      'Unauthorized';
    const err = new Error(detail);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as Record<string, unknown>));
    const fromErrors =
      Array.isArray(body?.errors) ? (body.errors as string[]).filter(Boolean).join(' ') : '';
    const msg =
      (body?.detail as string | undefined) ||
      (body?.message as string | undefined) ||
      fromErrors ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return res.json() as Promise<MeResponse>;
}

async function fetchMeWithOptionalRefresh(token: string): Promise<MeResponse> {
  try {
    return await fetchMe(token);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    if (st === 401 && (await tryRefreshAccessToken())) {
      const t2 = getAccessToken();
      if (t2) return await fetchMe(t2);
    }
    throw e;
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<NetUser | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [effectivePermissions, setEffectivePermissions] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    clearAllAuthTokens();
    setUser(null);
    setSession(null);
    setProfile(null);
    setEffectivePermissions(null);
  }, []);

  const applyAuth = useCallback(
    (token: string, userId: string, email: string, name: string, role: string, active: boolean) => {
      const nr = normalizeRole(role);
      const netUser: NetUser = { id: userId, email, name, role: nr };
      const userProfile: UserProfile = {
        id: userId,
        user_id: userId,
        name,
        email,
        role: nr,
        active,
      };
      setUser(netUser);
      setSession({ access_token: token });
      setProfile(userProfile);
      saveAccessToken(token);
    },
    [],
  );

  const loadEffectivePermissions = useCallback(async (token: string) => {
    const fetchPerms = async (t: string) => {
      const res = await fetch(`${API_BASE}/api/v1/auth/permissions`, {
        headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' },
      });
      if (res.status === 401 || res.status === 403) {
        if (res.status === 403) {
          const body = await res.json().catch(() => ({} as Record<string, unknown>));
          const friendly =
            typeof body?.message === 'string' && body.message.trim()
              ? String(body.message).trim()
              : 'You do not have permission to perform this action.';
          const err = new Error(friendly);
          (err as Error & { status?: number }).status = res.status;
          throw err;
        }
        const err = new Error('Unauthorized');
        (err as Error & { status?: number }).status = res.status;
        throw err;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<MyPermissionsResponse>;
    };
    try {
      try {
        const data = await fetchPerms(token);
        setEffectivePermissions(Array.isArray(data.permissions) ? data.permissions : []);
      } catch (e) {
        const st = (e as Error & { status?: number }).status;
        if (st === 401 && (await tryRefreshAccessToken())) {
          const t2 = getAccessToken();
          if (t2) {
            const data = await fetchPerms(t2);
            setEffectivePermissions(Array.isArray(data.permissions) ? data.permissions : []);
            return;
          }
        }
        setEffectivePermissions(null);
      }
    } catch {
      setEffectivePermissions(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const me = await fetchMeWithOptionalRefresh(token);
      if (!me.active) {
        clearSession();
        return;
      }
      const latest = getAccessToken() ?? token;
      applyAuth(latest, me.user_id, me.email, me.name, me.role, me.active);
      await loadEffectivePermissions(latest);
    } catch (e) {
      const st = (e as Error & { status?: number }).status;
      if (st === 401 || st === 403) clearSession();
    }
  }, [applyAuth, clearSession, loadEffectivePermissions]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    fetchMeWithOptionalRefresh(token)
      .then(async me => {
        if (getAccessToken() !== token) return;
        if (!me.active) {
          clearSession();
          return;
        }
        const latest = getAccessToken() ?? token;
        applyAuth(latest, me.user_id, me.email, me.name, me.role, me.active);
        await loadEffectivePermissions(latest);
      })
      .catch(() => {
        // Avoid wiping a fresh login: an in-flight /me for an old token can finish
        // after signIn() has already stored a new JWT.
        const now = getAccessToken();
        if (now === token || now === null) clearSession();
      })
      .finally(() => setLoading(false));
  }, [applyAuth, clearSession, loadEffectivePermissions]);

  useEffect(() => {
    if (!user) return;
    const onFocus = () => {
      void refreshProfile();
    };
    window.addEventListener('focus', onFocus);
    const tid = window.setInterval(() => {
      void refreshProfile();
    }, 5 * 60 * 1000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(tid);
    };
  }, [user, refreshProfile]);

  /** Proactively rotate access token before expiry (single-shot timer per mount). */
  useEffect(() => {
    if (!user) return;
    const token = getAccessToken();
    const ms = msUntilJwtExpiry(token, 75);
    if (ms == null || ms < 2000) return;
    const tid = window.setTimeout(async () => {
      if (await tryRefreshAccessToken()) {
        const nt = getAccessToken();
        if (nt) setSession({ access_token: nt });
      }
    }, ms);
    return () => window.clearTimeout(tid);
  }, [user, session?.access_token]);

  const userRole = profile?.role ?? SplmRoles.Viewer;
  const normalizedRole = normalizeRole(userRole);
  const isAdmin = normalizedRole === SplmRoles.Admin;
  const can = useCallback(
    (permission: string) => {
      if (effectivePermissions != null) return effectivePermissions.includes(permission);
      return roleHasPermission(userRole, permission);
    },
    [effectivePermissions, userRole],
  );

  const signIn = async (email: string, password: string) => {
    const data = await authFetch<AuthTokensJson>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const raw = data as AuthTokensJson & { Token?: string };
    const accessToken = (raw.access_token ?? raw.token ?? raw.Token)?.trim();
    if (!accessToken) {
      throw new Error('Login succeeded but the server did not return an access token.');
    }
    if (!looksLikeAccessJwt(accessToken)) {
      throw new Error('Login returned a non-JWT access token. Clear site data and sign in again, or contact support.');
    }
    if (raw.refresh_token) saveRefreshToken(raw.refresh_token);
    saveAccessToken(accessToken);

    let me: MeResponse;
    try {
      me = await fetchMeWithOptionalRefresh(accessToken);
    } catch (e) {
      clearSession();
      throw e;
    }
    if (!me.active) {
      clearSession();
      throw new Error('This account is disabled.');
    }
    const latest = getAccessToken() ?? accessToken;
    applyAuth(latest, me.user_id, me.email, me.name, me.role, me.active);
    await loadEffectivePermissions(latest);
  };

  const signUp = async (email: string, password: string, name: string) => {
    const data = await authFetch<AuthTokensJson>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    const raw = data as AuthTokensJson & { Token?: string };
    const accessToken = (raw.access_token ?? raw.token ?? raw.Token)?.trim();
    if (!accessToken) {
      throw new Error('Registration succeeded but the server did not return an access token.');
    }
    if (!looksLikeAccessJwt(accessToken)) {
      throw new Error('Registration returned a non-JWT access token. Clear site data and try again, or contact support.');
    }
    if (raw.refresh_token) saveRefreshToken(raw.refresh_token);
    saveAccessToken(accessToken);

    let me: MeResponse;
    try {
      me = await fetchMeWithOptionalRefresh(accessToken);
    } catch (e) {
      clearSession();
      throw e;
    }
    if (!me.active) {
      clearSession();
      throw new Error('This account is disabled.');
    }
    const latest = getAccessToken() ?? accessToken;
    applyAuth(latest, me.user_id, me.email, me.name, me.role, me.active);
    await loadEffectivePermissions(latest);
  };

  const signOut = async () => {
    const t = getAccessToken();
    if (t) {
      try {
        await fetch(`${API_BASE}/api/v1/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' },
        });
      } catch {
        /* ignore network errors */
      }
    }
    clearSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        userRole,
        normalizedRole,
        isAdmin,
        loading,
        signIn,
        signUp,
        signOut,
        can,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
