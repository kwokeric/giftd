import { createHash } from "node:crypto";
import { kv } from "./kv";

/**
 * Per-IP limits, counted per clock hour in Redis. A full quiz with a few rerolls is about 10
 * turn calls, so 60 an hour is plenty for people and still caps what one script can cost.
 *
 * Fails open: if Redis is missing or down, requests go through (logged), so an outage there
 * doesn't take the quiz down with it.
 */
export const LIMITS = {
  turn: { max: 60, windowSeconds: 60 * 60 },
  share: { max: 10, windowSeconds: 60 * 60 },
} as const;

export type LimitName = keyof typeof LIMITS;

/** The visitor's IP. On Vercel, x-forwarded-for is set by the platform, not the browser. */
export function clientIp(headers: Headers): string {
  return headers.get("x-real-ip") || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

// IPs are hashed before they're stored, and the keys expire with the window.
const hashIp = (ip: string) => createHash("sha256").update(`giftd:${ip}`).digest("base64url").slice(0, 16);

/** True if this request is over the limit. Counts the request either way. */
export async function overLimit(name: LimitName, headers: Headers, now = Date.now()): Promise<boolean> {
  if (process.env.NODE_ENV === "development") return false; // `next dev`: never in the way while building
  const store = kv();
  if (!store) return false;
  const { max, windowSeconds } = LIMITS[name];
  const window = Math.floor(now / 1000 / windowSeconds);
  try {
    const count = await store.incr(`rl:${name}:${hashIp(clientIp(headers))}:${window}`, windowSeconds);
    return count > max;
  } catch (err) {
    console.error(`[rate-limit] ${name} check failed, letting it through`, err);
    return false;
  }
}

/** The response for a request over the limit; the client shows its "take a breather" message. */
export const tooMany = (name: LimitName) =>
  Response.json(
    { error: "Too many requests" },
    { status: 429, headers: { "Retry-After": String(LIMITS[name].windowSeconds - Math.floor((Date.now() / 1000) % LIMITS[name].windowSeconds)) } },
  );
