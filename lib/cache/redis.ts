import { Redis } from "@upstash/redis";

let client: Redis | null | undefined;

/**
 * Upstash Redis when env is configured; otherwise null (app runs without cache).
 */
export function getRedis(): Redis | null {
  if (client !== undefined) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    client = null;
    return client;
  }

  client = new Redis({ url, token });
  return client;
}

export function isRedisConfigured(): boolean {
  return getRedis() != null;
}

/**
 * Cache-aside helper. On miss (or Redis unavailable), runs loader and stores result.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  const redis = getRedis();
  if (redis) {
    try {
      const hit = await redis.get<T>(key);
      if (hit != null) return hit;
    } catch (error) {
      console.warn(`[cache] get failed for ${key}:`, error);
    }
  }

  const value = await loader();

  if (redis) {
    try {
      await redis.set(key, value, { ex: ttlSeconds });
    } catch (error) {
      console.warn(`[cache] set failed for ${key}:`, error);
    }
  }

  return value;
}

/** Best-effort delete; never throws to callers. */
export async function invalidate(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.del(...keys);
  } catch (error) {
    console.warn(`[cache] invalidate failed for ${keys.join(", ")}:`, error);
  }
}
