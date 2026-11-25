import { Redis } from "@upstash/redis";
import { customAlphabet } from "nanoid";
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

function redis(): Redis | null {
  // Upstash's own names, or the KV_* names the Vercel Marketplace integration sets.
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

// Local development without Redis: keep shares in memory (lost on restart).
const g = globalThis as { __giftdShares?: Map<string, ShareRecord> };
const memory = (g.__giftdShares ??= new Map());

/** In production, sharing needs Redis; in development the in-memory store is fine. */
export const sharingAvailable = () => redis() !== null || process.env.NODE_ENV !== "production";

export async function saveShare(record: ShareRecord): Promise<string> {
  const id = newId();
  const r = redis();
  if (r) await r.set(`share:${id}`, record, { ex: SHARE_TTL_SECONDS });
  else memory.set(id, record);
  return id;
}

export async function loadShare(id: string): Promise<ShareRecord | null> {
  if (!ID_PATTERN.test(id)) return null;
  const r = redis();
  const raw = r ? await r.get(`share:${id}`) : memory.get(id);
  const parsed = ShareRecord.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
