import { customAlphabet } from "nanoid";
import { z } from "zod";
import { kv } from "./kv";
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

/** In production, sharing needs Redis; in development the in-memory store is fine. */
export const sharingAvailable = () => kv() !== null;

export async function saveShare(record: ShareRecord): Promise<string> {
  const id = newId();
  await kv()!.set(`share:${id}`, record, SHARE_TTL_SECONDS);
  return id;
}

export async function loadShare(id: string): Promise<ShareRecord | null> {
  if (!ID_PATTERN.test(id)) return null;
  const s = kv();
  if (!s) return null;
  const parsed = ShareRecord.safeParse(await s.get(`share:${id}`));
  return parsed.success ? parsed.data : null;
}
