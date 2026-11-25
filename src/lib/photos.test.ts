import { afterEach, describe, expect, it, vi } from "vitest";
import { findPhoto } from "./photos";
import { Gift } from "./schemas";
import { signGift, verifyGift } from "./sign";

const pexels = (photos: unknown[]) =>
  vi.fn(async () => new Response(JSON.stringify({ photos }), { status: 200 })) as unknown as typeof fetch;

const PHOTO = {
  alt: "Coffee being poured",
  avg_color: "#8A6B4F",
  photographer: "Sam Lee",
  photographer_url: "https://www.pexels.com/@samlee",
  src: { large2x: "https://images.pexels.com/photos/1/pexels-photo-1.jpeg?auto=compress&w=940" },
};

afterEach(() => vi.unstubAllEnvs());

describe("gift photos", () => {
  it("finds a Pexels photo and caches it", async () => {
    vi.stubEnv("PEXELS_API_KEY", "test-key");
    const fetch = pexels([PHOTO]);
    const photo = await findPhoto("Pour Over Coffee", fetch);
    expect(photo).toEqual({
      src: PHOTO.src.large2x,
      alt: PHOTO.alt,
      color: PHOTO.avg_color,
      by: "Sam Lee",
      byUrl: PHOTO.photographer_url,
    });
    expect(await findPhoto("pour over coffee", fetch)).toEqual(photo);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("gives no photo without a key, or when nothing usable comes back", async () => {
    expect(await findPhoto("hot sauce", pexels([PHOTO]))).toBeNull();
    vi.stubEnv("PEXELS_API_KEY", "test-key");
    expect(await findPhoto("nothing matches", pexels([]))).toBeNull();
    const elsewhere = { ...PHOTO, src: { large2x: "https://example.com/x.jpg" } };
    expect(await findPhoto("wrong host", pexels([elsewhere]))).toBeNull();
  });

  it("only accepts Pexels images on a gift, and signs the photo with it", () => {
    const gift = {
      kind: "safe",
      name: "Pour-over coffee kit",
      priceRange: "$40–60",
      category: "coffee_tea",
      searchQuery: "pour over coffee kit",
      photo: { src: PHOTO.src.large2x, alt: "", by: "Sam Lee", byUrl: PHOTO.photographer_url },
    } as const;
    expect(Gift.safeParse(gift).success).toBe(true);
    expect(Gift.safeParse({ ...gift, photo: { ...gift.photo, src: "https://example.com/x.jpg" } }).success).toBe(false);

    const sig = signGift(gift)!;
    expect(verifyGift(gift, sig)).toBe(true);
    const swapped = { ...gift, photo: { ...gift.photo, src: "https://images.pexels.com/photos/2/other.jpeg" } };
    expect(verifyGift(swapped, sig)).toBe(false);
  });
});
