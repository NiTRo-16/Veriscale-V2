'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { backoffDelay } from '@/lib/backoff';

export type SaveStatus = 'saved' | 'saving' | 'retrying' | 'failed';
type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * Saves `value` about `delay` ms after it stops changing.
 * - A thrown error (e.g. network) retries with back-off: 1s, 2s, 4s … 30s.
 * - A returned `{ ok: false }` (e.g. report locked) stops and shows the message.
 * - `flush()` saves immediately and resolves true when everything is saved.
 */
export function useAutosave<T>(value: T, save: (value: T) => Promise<SaveResult>, delay = 1000) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [error, setError] = useState<string | null>(null);

  const latest = useRef(value);
  const savedKey = useRef(JSON.stringify(value));
  const saveRef = useRef(save);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempts = useRef(0);
  const running = useRef<Promise<boolean> | null>(null);
  const runRef = useRef<() => Promise<boolean>>(async () => true);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const schedule = useCallback(
    (ms: number) => {
      clearTimer();
      timer.current = setTimeout(() => void runRef.current(), ms);
    },
    [clearTimer],
  );

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    runRef.current = async () => {
      if (running.current) await running.current;
      const snapshot = latest.current;
      const key = JSON.stringify(snapshot);
      if (key === savedKey.current) {
        setStatus((s) => (s === 'failed' ? s : 'saved'));
        return true;
      }

      setStatus('saving');
      const attempt = (async () => {
        try {
          const result = await saveRef.current(snapshot);
          if (!result.ok) {
            setStatus('failed');
            setError(result.error);
            return false;
          }
          savedKey.current = key;
          attempts.current = 0;
          setError(null);
          if (JSON.stringify(latest.current) !== key) schedule(delay);
          else setStatus('saved');
          return true;
        } catch {
          attempts.current += 1;
          setStatus('retrying');
          schedule(backoffDelay(attempts.current));
          return false;
        }
      })();

      running.current = attempt;
      try {
        return await attempt;
      } finally {
        running.current = null;
      }
    };
  });

  useEffect(() => {
    latest.current = value;
    if (JSON.stringify(value) !== savedKey.current) schedule(delay);
  }, [value, delay, schedule]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(latest.current) !== savedKey.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      clearTimer();
    };
  }, [clearTimer]);

  const flush = useCallback(async () => {
    clearTimer();
    return runRef.current();
  }, [clearTimer]);

  return { status, error, flush };
}
