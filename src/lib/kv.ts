import { Redis } from "@upstash/redis";
import { createClient } from "redis";
import type { RedisClientType } from "redis";

/**
 * The little bit of Redis giftd needs (share links and rate limits), the same for every backend:
 * - REDIS_URL: any Redis by connection string (Vercel's Redis integration sets this)
 * - Upstash over HTTP: UPSTASH_REDIS_REST_URL/TOKEN, or the KV_REST_API_* names its integration sets
 * - neither, outside production: an in-memory map, lost on restart
 * In production without either, kv() is null and callers decide what that means.
 */
export type KV = {
  /** Stores JSON with an expiry. */
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  /** The parsed JSON, or null. */
  get(key: string): Promise<unknown>;
  /** Adds 1 and returns the new count; a new key expires after ttlSeconds. */
  incr(key: string, ttlSeconds: number): Promise<number>;
};

const g = globalThis as {
  __giftdRedis?: Promise<RedisClientType>;
  __giftdMemory?: Map<string, { value: unknown; expires: number }>;
};

function upstash(): KV | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const r = new Redis({ url, token });
  return {
    set: async (key, value, ttl) => void (await r.set(key, value, { ex: ttl })),
    get: (key) => r.get(key),
    incr: async (key, ttl) => {
      const [count] = await r.multi().incr(key).expire(key, ttl, "NX").exec<[number, number]>();
      return count;
    },
  };
}

// One connection per server instance, reused across requests.
function redisUrl(): KV | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const client = () =>
    (g.__giftdRedis ??= (async () => {
      const c = createClient({ url, socket: { connectTimeout: 3000 } }) as RedisClientType;
      c.on("error", (err) => console.error("[redis]", err));
      await c.connect();
      return c;
    })().catch((err) => {
      g.__giftdRedis = undefined; // try again on the next request
      throw err;
    }));
  return {
    set: async (key, value, ttl) => void (await (await client()).set(key, JSON.stringify(value), { EX: ttl })),
    get: async (key) => {
      const raw = await (await client()).get(key);
      return raw ? JSON.parse(raw) : null;
    },
    incr: async (key, ttl) => {
      const [count] = await (await client()).multi().incr(key).expire(key, ttl, "NX").exec();
      return Number(count);
    },
  };
}

const memory = (g.__giftdMemory ??= new Map());
const live = (key: string) => {
  const e = memory.get(key);
  if (e && e.expires <= Date.now()) memory.delete(key);
  return memory.get(key);
};
const memoryKV: KV = {
  set: async (key, value, ttl) => void memory.set(key, { value, expires: Date.now() + ttl * 1000 }),
  get: async (key) => live(key)?.value ?? null,
  incr: async (key, ttl) => {
    const e = live(key);
    const count = (e ? Number(e.value) : 0) + 1;
    memory.set(key, { value: count, expires: e?.expires ?? Date.now() + ttl * 1000 });
    return count;
  },
};

export const kv = (): KV | null => upstash() ?? redisUrl() ?? (process.env.NODE_ENV !== "production" ? memoryKV : null);
