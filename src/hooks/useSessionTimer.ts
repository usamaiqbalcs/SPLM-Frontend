import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Session countdown timer.
 * - Resets on any user activity (mouse, keyboard, scroll, touch)
 * - Calls onExpire() when countdown reaches zero
 * - Shows a warning state when under 5 minutes remain
 */
export function useSessionTimer(minutes = 30, onExpire?: () => void) {
  const [secs, setSecs] = useState(minutes * 60);
  const onExpireRef = useRef(onExpire);
  const expiredRef = useRef(false);
  onExpireRef.current = onExpire;

  const reset = useCallback(() => {
    setSecs(minutes * 60);
    expiredRef.current = false;
  }, [minutes]);

  // Reset timer on any user activity
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'pointermove'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, reset));
  }, [reset]);

  // Countdown tick
  useEffect(() => {
    const interval = setInterval(() => {
      setSecs(s => {
        if (s <= 1) {
          if (!expiredRef.current) {
            expiredRef.current = true;
            // Use setTimeout to safely call onExpire outside of setState
            setTimeout(() => onExpireRef.current?.(), 0);
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [minutes]);

  const mins = Math.floor(secs / 60);
  const seconds = secs % 60;
  const display = `${mins}:${String(seconds).padStart(2, '0')}`;
  const isWarning = secs > 0 && secs <= 5 * 60; // under 5 minutes
  const isExpired = secs === 0;

  return { display, secs, isWarning, isExpired, reset };
}
