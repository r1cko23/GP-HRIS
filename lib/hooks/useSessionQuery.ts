"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SESSION_STALE_MS,
  SESSION_TTL_MS,
  prefetchSessionJson,
  prefetchSessionLoad,
  sessionCacheGet,
  sessionFetchJson,
  sessionLoadJson,
} from "@/lib/session-cache";

type PrefetchTarget =
  | { key: string; url: string }
  | { key: string; fetcher: () => Promise<unknown> };

type Options = {
  enabled?: boolean;
  staleTime?: number;
  ttl?: number;
  prefetch?: PrefetchTarget[];
};

type Source<T> = string | (() => Promise<T>);

function runPrefetch(targets: PrefetchTarget[]): void {
  for (const p of targets) {
    if ("url" in p) prefetchSessionJson(p.key, p.url);
    else prefetchSessionLoad(p.key, p.fetcher);
  }
}

/**
 * Hydration-safe session-backed query.
 * Restores sessionStorage in useEffect (not useState init).
 * `source` may be a URL string or an async fetcher (e.g. Supabase).
 */
export function useSessionQuery<T>(
  key: string | null,
  source: Source<T> | null,
  options: Options = {}
) {
  const {
    enabled = true,
    staleTime = SESSION_STALE_MS,
    ttl = SESSION_TTL_MS,
    prefetch = [],
  } = options;

  const prefetchRef = useRef(prefetch);
  prefetchRef.current = prefetch;

  // Keep fetcher identity stable across renders (avoid refresh loops).
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const sourceUrl = typeof source === "string" ? source : null;
  const hasSource = source != null;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!(enabled && key && hasSource));
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const gen = useRef(0);

  useEffect(() => {
    if (!enabled || !key) {
      setReady(true);
      return;
    }
    const cached = sessionCacheGet<T>(key, ttl);
    if (cached) {
      setData(cached.data);
      setLoading(false);
    }
    setReady(true);
  }, [enabled, key, ttl]);

  const refresh = useCallback(
    async (opts?: { force?: boolean }) => {
      const src = sourceRef.current;
      if (!enabled || !key || !src) return;
      const my = ++gen.current;
      const cached = sessionCacheGet<T>(key, ttl);
      const age = cached ? Date.now() - cached.at : Infinity;
      const needsNetwork = opts?.force || !cached || age > staleTime;

      if (cached) {
        setData(cached.data);
        setLoading(false);
      }
      if (!needsNetwork) {
        runPrefetch(prefetchRef.current);
        return;
      }

      if (!cached) setLoading(true);
      else setValidating(true);
      setError(null);

      try {
        const fresh =
          typeof src === "string"
            ? await sessionFetchJson<T>(key, src)
            : await sessionLoadJson(key, src);
        if (gen.current !== my) return;
        setData(fresh);
        runPrefetch(prefetchRef.current);
      } catch (err) {
        if (gen.current !== my) return;
        if (!cached) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (gen.current === my) {
          setLoading(false);
          setValidating(false);
        }
      }
    },
    [enabled, key, sourceUrl, hasSource, ttl, staleTime]
  );

  useEffect(() => {
    if (!ready) return;
    void refresh();
  }, [ready, refresh]);

  return { data, loading, validating, error, refresh };
}
