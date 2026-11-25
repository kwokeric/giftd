import { GiftPhoto } from "./schemas";

/**
 * Stock photos for gift ideas, from Pexels (free; https://www.pexels.com/api/). The picks are
 * ideas, not products, so the photo shows the kind of thing, not the exact item.
 *
 * Without PEXELS_API_KEY, or when nothing matches or Pexels is slow, gifts get no photo and the
 * card shows its category tile instead. Pexels allows 200 requests an hour by default; the cache
 * below helps with repeat ideas, and Pexels raises the limit for free on request.
 */
const TIMEOUT_MS = 2500;
const CACHE_MAX = 500;

const g = globalThis as { __giftdPhotos?: Map<string, GiftPhoto | null> };
const cache = (g.__giftdPhotos ??= new Map());

type PexelsPhoto = {
  url?: string;
  alt?: string;
  avg_color?: string;
  photographer?: string;
  photographer_url?: string;
  src?: { large2x?: string };
};

export async function findPhoto(query: string, fetchImpl: typeof fetch = fetch): Promise<GiftPhoto | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  const q = query.trim().toLowerCase().slice(0, 60);
  if (!q) return null;
  if (cache.has(q)) return cache.get(q)!;

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=1`;
  const res = await fetchImpl(url, { headers: { Authorization: key }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`pexels ${res.status}`); // not cached: may work next time
  const body = (await res.json()) as { photos?: PexelsPhoto[] };
  const p = body.photos?.[0];
  const parsed = GiftPhoto.safeParse(
    p && {
      src: p.src?.large2x,
      alt: (p.alt || q).slice(0, 200),
      color: p.avg_color,
      by: p.photographer,
      byUrl: p.photographer_url,
    },
  );
  const photo = parsed.success ? parsed.data : null;

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(q, photo);
  return photo;
}
