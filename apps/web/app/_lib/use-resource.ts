'use client';

import { useEffect, useRef, useState } from 'react';
import type { ApiErrorShape, ApiResult } from './api';

export interface Resource<T> {
  status: 'loading' | 'ready' | 'error';
  data: T | null;
  error: ApiErrorShape | null;
  reload: () => void;
}

/**
 * Tai du lieu that tu API. Khong co trang thai "gia dinh da co du lieu".
 * `deps` duoc noi thanh khoa: doi khoa => tai lai.
 */
export function useResource<T>(load: () => Promise<ApiResult<T>>, deps: readonly unknown[]): Resource<T> {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [tick, setTick] = useState(0);

  const loadRef = useRef(load);
  loadRef.current = load;
  const key = JSON.stringify(deps);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    void loadRef.current().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setData(result.data);
        setError(null);
        setStatus('ready');
      } else {
        setError(result.error);
        setStatus('error');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [key, tick]);

  return { status, data, error, reload: () => setTick((n) => n + 1) };
}
