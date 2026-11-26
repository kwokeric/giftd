import { afterEach, describe, expect, it, vi } from "vitest";
import { findPhoto } from "./photos";
import { Gift } from "./schemas";
import { signGift, verifyGift } from "./sign";

const unsplash = (results: unknown[]) =>
  vi.fn(async () => new Response(JSON.stringify({ results }), { status: 200 })) as unknown as typeof fetch;

const PHOTO = {
  alt_description: "coffee being poured",
  color: "#8a6b4f",
  urls: { regular: "https://images.unsplash.com/photo-1?ixid=abc&w=1080&q=80" },
  user: { name: "Sam Lee", links: { html: "https://unsplash.com/@samlee" } },
  links: { download_location: "https://api.unsplash.com/photos/1/download?ixid=abc" },
};

afterEach(() => vi.unstubAllEnvs());

describe("gift photos", () => {
  it("finds an Unsplash photo, reports its use once and caches it", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "test-key");
    const fetch = unsplash([PHOTO]);
    const photo = await findPhoto("Pour Over Coffee", fetch);
    expect(photo).toEqual({
      src: PHOTO.urls.regular,
      alt: PHOTO.alt_description,
      color: PHOTO.color,
      by: "Sam Lee",
      byUrl: "https://unsplash.com/@samlee?utm_source=giftd&utm_medium=referral",
    });
    expect(await findPhoto("pour over coffee", fetch)).toEqual(photo);
    const calls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
    expect(calls).toHaveLength(2); // one search, one download report; the repeat came from the cache
    expect(calls[1]).toBe(PHOTO.links.download_location);
  });

  it("gives no photo without a key, or when nothing usable comes back", async () => {
    expect(await findPhoto("hot sauce", unsplash([PHOTO]))).toBeNull();
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "test-key");
    expect(await findPhoto("nothing matches", unsplash([]))).toBeNull();
    const elsewhere = { ...PHOTO, urls: { regular: "https://example.com/x.jpg" } };
    expect(await findPhoto("wrong host", unsplash([elsewhere]))).toBeNull();
  });

  it("only accepts Unsplash images on a gift, and signs the photo with it", () => {
    const gift = {
      kind: "safe",
      name: "Pour-over coffee kit",
      priceRange: "$40–60",
      category: "coffee_tea",
      searchQuery: "pour over coffee kit",
      photo: { src: PHOTO.urls.regular, alt: "", by: "Sam Lee", byUrl: "https://unsplash.com/@samlee" },
    } as const;
    expect(Gift.safeParse(gift).success).toBe(true);
    expect(Gift.safeParse({ ...gift, photo: { ...gift.photo, src: "https://example.com/x.jpg" } }).success).toBe(false);

    const sig = signGift(gift)!;
    expect(verifyGift(gift, sig)).toBe(true);
    const swapped = { ...gift, photo: { ...gift.photo, src: "https://images.unsplash.com/photo-2" } };
    expect(verifyGift(swapped, sig)).toBe(false);
  });
});
