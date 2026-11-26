import { Redis } from "@upstash/redis";
import { customAlphabet } from "nanoid";
import { createClient } from "redis";
import type { RedisClientType } from "redis";
import { z } from "zod";
import { MAX_ANSWERS } from "./plan-walk";
import { AnswerSchema, Gift, Occasion } from "./schemas";
import { RELATIONSHIPS } from "./types";

/** A shared result. Only option IDs and gifts: no free text, IPs or anything personal. */
export const ShareRecord = z.object({
  v: z.literal(1),
  occasion: Occasion,
  relationship: z.enum(RELATIONSHIPS).nullable(),
  answers: z.array(AnswerSchema).max(MAX_ANSWERS),
  gifts: z.array(Gift).length(3),
  createdAt: z.string(),
});
export type ShareRecord = z.infer<typeof ShareRecord>;

export const SHARE_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days

// 8 characters without look-alikes (0/O, 1/l/I): easy to read aloud, ~45 bits of randomness.
const newId = customAlphabet("23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ", 8);
const ID_PATTERN = /^[2-9a-zA-Z]{8}$/;

/** Where shares live: a small get/set with expiry, the same for every backend. */
type Store = {
  set(key: string, value: ShareRecord, ttlSeconds: number): Promise<void>;
  get(key: string): Promise<unknown>;
};

// Upstash over HTTP: Upstash's own names, or the KV_* names its Vercel integration sets.
function upstash(): Store | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const r = new Redis({ url, token });
  return {
    set: async (key, value, ttl) => void (await r.set(key, value, { ex: ttl })),
    get: (key) => r.get(key),
  };
}

// Any Redis by connection string: REDIS_URL, which Vercel's Redis (Redis Inc.) integration sets.
// One connection per server instance, reused across requests.
const g = globalThis as { __giftdShares?: Map<string, ShareRecord>; __giftdRedis?: Promise<RedisClientType> };

function redisUrl(): Store | null {
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
  };
}

// Local development without Redis: keep shares in memory (lost on restart).
const memory = (g.__giftdShares ??= new Map());
const memoryStore: Store = {
  set: async (key, value) => void memory.set(key, value),
  get: async (key) => memory.get(key),
};

const store = (): Store | null =>
  upstash() ?? redisUrl() ?? (process.env.NODE_ENV !== "production" ? memoryStore : null);

/** In production, sharing needs Redis; in development the in-memory store is fine. */
export const sharingAvailable = () => store() !== null;

export async function saveShare(record: ShareRecord): Promise<string> {
  const id = newId();
  await store()!.set(`share:${id}`, record, SHARE_TTL_SECONDS);
  return id;
}

export async function loadShare(id: string): Promise<ShareRecord | null> {
  if (!ID_PATTERN.test(id)) return null;
  const s = store();
  if (!s) return null;
  const parsed = ShareRecord.safeParse(await s.get(`share:${id}`));
  return parsed.success ? parsed.data : null;
}
