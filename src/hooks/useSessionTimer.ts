import { useEffect, useCallback, useRef } from 'react';

/**
 * Session inactivity timer.
 * - Resets on any user activity (mouse, keyboard, scroll, touch)
 * - Calls onExpire() when inactivity timeout is reached
 * - Optionally calls onWarn() before expiry
 *
 * Important: this hook intentionally does not keep per-second countdown state,
 * so removing countdown UI does not leave a background tick/re-render loop.
 */
export function useSessionTimer(
  minutes = 30,
  onExpire?: () => void,
  options?: { onWarn?: () => void; warnBeforeSeconds?: number },
) {
  const warnBeforeSeconds = options?.warnBeforeSeconds ?? 5 * 60;
  const onExpireRef = useRef(onExpire);
  const onWarnRef = useRef(options?.onWarn);
  const expireTimeoutRef = useRef<number | null>(null);
  const warnTimeoutRef = useRef<number | null>(null);
  const expiryAtRef = useRef<number>(Date.now() + minutes * 60 * 1000);
  const expiredRef = useRef(false);
  const warnedRef = useRef(false);
  onExpireRef.current = onExpire;
  onWarnRef.current = options?.onWarn;

  const clearTimers = useCallback(() => {
    if (expireTimeoutRef.current != null) {
      window.clearTimeout(expireTimeoutRef.current);
      expireTimeoutRef.current = null;
    }
    if (warnTimeoutRef.current != null) {
      window.clearTimeout(warnTimeoutRef.current);
      warnTimeoutRef.current = null;
    }
  }, []);

  const schedule = useCallback(() => {
    clearTimers();
    const now = Date.now();
    const remainingMs = Math.max(0, expiryAtRef.current - now);
    if (remainingMs <= 0) {
      if (!expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current?.();
      }
      return;
    }

    const warnMs = remainingMs - warnBeforeSeconds * 1000;
    if (warnMs <= 0) {
      if (!warnedRef.current && !expiredRef.current) {
        warnedRef.current = true;
        onWarnRef.current?.();
      }
    } else {
      warnTimeoutRef.current = window.setTimeout(() => {
        if (!warnedRef.current && !expiredRef.current) {
          warnedRef.current = true;
          onWarnRef.current?.();
        }
      }, warnMs);
    }

    expireTimeoutRef.current = window.setTimeout(() => {
      if (!expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current?.();
      }
    }, remainingMs);
  }, [clearTimers, warnBeforeSeconds]);

  const reset = useCallback(() => {
    expiryAtRef.current = Date.now() + minutes * 60 * 1000;
    expiredRef.current = false;
    warnedRef.current = false;
    schedule();
  }, [minutes, schedule]);

  useEffect(() => {
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      clearTimers();
    };
  }, [clearTimers, reset]);

  return { reset };
}
