import { describe, expect, it } from 'vitest';
import { msUntilJwtExpiry, readJwtExpSeconds } from '@/lib/token-lifecycle';

/** Minimal JWT-shaped string with exp claim (payload only; not verified). */
function fakeJwt(expSeconds: number): string {
  const b64 = btoa(JSON.stringify({ exp: expSeconds }));
  const payload = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `h.${payload}.s`;
}

describe('token-lifecycle', () => {
  it('reads exp from jwt', () => {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600;
    expect(readJwtExpSeconds(fakeJwt(exp))).toBe(exp);
  });

  it('msUntilJwtExpiry accounts for skew', () => {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 120;
    const jwt = fakeJwt(exp);
    const ms = msUntilJwtExpiry(jwt, 60);
    expect(ms).not.toBeNull();
    expect(ms!).toBeGreaterThan(0);
    expect(ms!).toBeLessThanOrEqual(60_000);
  });
});
