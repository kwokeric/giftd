import { GiftPhoto } from "./schemas";

/**
 * Stock photos for gift ideas, from Unsplash (free; https://unsplash.com/developers). The picks are
 * ideas, not products, so the photo shows the kind of thing, not the exact item.
 *
 * Without UNSPLASH_ACCESS_KEY, or when nothing matches or Unsplash is slow, gifts get no photo and
 * the card shows its category tile instead. A new Unsplash app allows 50 requests an hour; apply
 * for production access (about 5,000 an hour) before launch. The cache below helps with repeat ideas.
 *
 * Unsplash's API rules, all followed here: show their image URLs as-is (hotlinking), credit the
 * photographer and Unsplash with links tagged with the app name, and report each photo used via
 * its download_location.
 */
const TIMEOUT_MS = 2500;
const CACHE_MAX = 500;
const UTM = "utm_source=giftd&utm_medium=referral";

const g = globalThis as { __giftdPhotos?: Map<string, GiftPhoto | null> };
const cache = (g.__giftdPhotos ??= new Map());

type UnsplashPhoto = {
  alt_description?: string | null;
  color?: string | null;
  urls?: { regular?: string };
  user?: { name?: string; links?: { html?: string } };
  links?: { download_location?: string };
};

const withUtm = (url: string | undefined) => url && `${url}${url.includes("?") ? "&" : "?"}${UTM}`;

export async function findPhoto(query: string, fetchImpl: typeof fetch = fetch): Promise<GiftPhoto | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  const q = query.trim().toLowerCase().slice(0, 60);
  if (!q) return null;
  if (cache.has(q)) return cache.get(q)!;

  const headers = { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" };
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=1&content_filter=high`;
  const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`unsplash ${res.status}`); // not cached: may work next time
  const body = (await res.json()) as { results?: UnsplashPhoto[] };
  const p = body.results?.[0];
  const parsed = GiftPhoto.safeParse(
    p && {
      src: p.urls?.regular,
      alt: (p.alt_description || q).slice(0, 200),
      color: p.color ?? undefined,
      by: p.user?.name,
      byUrl: withUtm(p.user?.links?.html),
    },
  );
  const photo = parsed.success ? parsed.data : null;

  // Required by Unsplash when a photo is used. Counted once per new photo, since cached ones were
  // already reported; never holds up the results.
  const track = p?.links?.download_location;
  if (photo && track?.startsWith("https://api.unsplash.com/")) {
    void fetchImpl(track, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => {});
  }

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(q, photo);
  return photo;
}
