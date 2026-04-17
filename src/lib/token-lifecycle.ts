/**
 * Access + refresh token storage and rotation helpers.
 * Refresh tokens are opaque secrets; keep them out of logs. Stored in localStorage (same-origin SPA limitation).
 */

import { getApiBaseUrl, parseSuccessJson } from '@/lib/api-http';

const API_BASE = getApiBaseUrl();

export const ACCESS_TOKEN_KEY = 'zenatech_jwt';
export const REFRESH_TOKEN_KEY = 'zenatech_refresh';

/** SPLM access tokens are HS256 JWS compact strings: header.payload.signature */
export function looksLikeAccessJwt(t: string | null | undefined): boolean {
  if (!t) return false;
  const s = t.trim();
  const parts = s.split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

export function getAccessToken(): string | null {
  try {
    const raw = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!raw?.trim()) return null;
    const s = raw.trim();
    if (!looksLikeAccessJwt(s)) {
      // Stale keys: opaque refresh or legacy values were stored as "jwt" — never send those as Bearer.
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function saveAccessToken(t: string): void {
  try {
    const s = t.trim();
    if (!looksLikeAccessJwt(s)) return;
    localStorage.setItem(ACCESS_TOKEN_KEY, s);
  } catch {}
}

export function clearAccessToken(): void {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {}
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveRefreshToken(t: string | null | undefined): void {
  try {
    if (t) localStorage.setItem(REFRESH_TOKEN_KEY, t);
    else localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {}
}

export function clearRefreshToken(): void {
  try {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {}
}

export function clearAllAuthTokens(): void {
  clearAccessToken();
  clearRefreshToken();
}

/** JWT `exp` in seconds since epoch, or null if payload missing/invalid. */
export function readJwtExpSeconds(accessToken: string | null | undefined): number | null {
  if (!accessToken) return null;
  const parts = accessToken.split('.');
  if (parts.length < 2) return null;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/** Milliseconds until access token expiry; negative if already expired. */
export function msUntilJwtExpiry(accessToken: string | null, skewSeconds = 90): number | null {
  const exp = readJwtExpSeconds(accessToken);
  if (exp == null) return null;
  return exp * 1000 - Date.now() - skewSeconds * 1000;
}

/**
 * Calls POST /auth/refresh. On success updates access + refresh in localStorage.
 * Returns false if no refresh token or refresh failed.
 */
export async function tryRefreshAccessToken(): Promise<boolean> {
  const rt = getRefreshToken();
  if (!rt) return false;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });
  } catch {
    return false;
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) clearAllAuthTokens();
    return false;
  }

  const d = await parseSuccessJson<Record<string, unknown>>(res, 'POST /auth/refresh');
  const token =
    typeof d.access_token === 'string'
      ? d.access_token.trim()
      : typeof d.token === 'string'
        ? d.token.trim()
        : typeof d.Token === 'string'
          ? d.Token.trim()
          : null;
  const nextRt = typeof d.refresh_token === 'string' ? d.refresh_token : null;
  if (!token || !looksLikeAccessJwt(token)) {
    clearAllAuthTokens();
    return false;
  }

  saveAccessToken(token);
  if (nextRt) saveRefreshToken(nextRt);
  return true;
}
