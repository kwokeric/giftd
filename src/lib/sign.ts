import { createHmac, timingSafeEqual } from "node:crypto";
import type { Gift } from "./schemas";

/**
 * Gifts are signed when the server generates them, so a share link can only contain gifts
 * giftd actually picked. Without this, anyone could POST made-up text to /api/share and get a
 * giftd-branded page (and preview image) with it.
 */
function secret(): string | null {
  return process.env.GIFTD_SHARE_SECRET || (process.env.NODE_ENV !== "production" ? "giftd-dev-only-secret" : null);
}

const payload = (g: Gift) => JSON.stringify([g.kind, g.name, g.why, g.priceRange, g.category, g.searchQuery]);

export function signGift(g: Gift): string | undefined {
  const s = secret();
  return s ? createHmac("sha256", s).update(payload(g)).digest("base64url") : undefined;
}

export function verifyGift(g: Gift, sig: string): boolean {
  const expected = signGift(g);
  if (!expected || expected.length !== sig.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

export const signingEnabled = () => secret() !== null;
