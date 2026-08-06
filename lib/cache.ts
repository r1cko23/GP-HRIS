/**
 * Server Redis read-through cache with epoch-based invalidation.
 * Degrades to BYPASS when Upstash env is unset.
 */

import { getRedis, isRedisConfigured } from "@/lib/cache/redis";

const EPOCH_KEY = "gp:cache:epoch";
const DEFAULT_TTL_SECONDS = 120;

let epochMemo: { value: number; at: number } | null = null;
const EPOCH_MEMO_MS = 10_000;

async function currentEpoch(): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  if (epochMemo && Date.now() - epochMemo.at < EPOCH_MEMO_MS) {
    return epochMemo.value;
  }
  try {
    const value = await redis.get<number | string>(EPOCH_KEY);
    const n = typeof value === "number" ? value : Number(value ?? 0);
    const epoch = Number.isFinite(n) ? n : 0;
    epochMemo = { value: epoch, at: Date.now() };
    return epoch;
  } catch (error) {
    console.warn("[cache] epoch read failed:", error);
    return 0;
  }
}

export async function cacheKey(parts: Array<string | number>): Promise<string> {
  const epoch = await currentEpoch();
  return ["gp", `e${epoch}`, ...parts.map(String)].join(":");
}

export async function cachedJson<T>(
  keyParts: Array<string | number>,
  loader: () => Promise<T>,
  ttlSeconds = DEFAULT_TTL_SECONDS
): Promise<{ data: T; cache: "HIT" | "MISS" | "BYPASS" }> {
  const redis = getRedis();
  if (!redis) {
    return { data: await loader(), cache: "BYPASS" };
  }

  let key: string;
  try {
    key = await cacheKey(keyParts);
    const hit = await redis.get<T>(key);
    if (hit !== null && hit !== undefined) {
      return { data: hit, cache: "HIT" };
    }
  } catch (error) {
    console.warn("[cache] get failed:", error);
    return { data: await loader(), cache: "BYPASS" };
  }

  const data = await loader();
  try {
    await redis.set(key, data, { ex: ttlSeconds });
  } catch (error) {
    console.warn("[cache] set failed:", error);
  }
  return { data, cache: "MISS" };
}

/** Bump global epoch so all epoch-scoped Redis keys miss on next read. */
export async function invalidateAppCache(): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const next = await redis.incr(EPOCH_KEY);
    epochMemo = { value: next, at: Date.now() };
    return true;
  } catch (error) {
    console.warn("[cache] epoch incr failed:", error);
    return false;
  }
}

export function isRedisEnabled(): boolean {
  return isRedisConfigured();
}
