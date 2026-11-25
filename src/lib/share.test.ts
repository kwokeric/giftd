import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/share/route";
import type { Gift } from "./schemas";
import { loadShare } from "./shares";
import { signGift, verifyGift } from "./sign";

const gifts: Gift[] = [
  { kind: "safe", name: "Photo book", why: "They cry at fridge magnets.", priceRange: "$60–90", category: "keepsakes_personalized", searchQuery: "photo book" },
  { kind: "wildcard", name: "Pottery class", why: "A new hobby.", priceRange: "$70–100", category: "experiences", searchQuery: "pottery class" },
  { kind: "budget", name: "Recipe box", why: "For the family recipes.", priceRange: "$50–65", category: "kitchen_cooking", searchQuery: "recipe box" },
];
const signed = gifts.map((g) => ({ ...g, sig: signGift(g) }));
const answers = [
  { questionId: "relationship", optionId: "relative" },
  { questionId: "age", optionId: "50s_60s" },
  { questionId: "budget", optionId: "50_100" },
];

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/share", { method: "POST", body: JSON.stringify(body) }));

describe("gift signatures", () => {
  it("verify only the exact gift that was signed", () => {
    const sig = signGift(gifts[0])!;
    expect(verifyGift(gifts[0], sig)).toBe(true);
    expect(verifyGift({ ...gifts[0], why: "Something else entirely" }, sig)).toBe(false);
    expect(verifyGift(gifts[0], "nope")).toBe(false);
  });
});

describe("POST /api/share", () => {
  it("saves signed gifts and can load them back", async () => {
    const res = await post({ occasion: "birthday", answers, gifts: signed });
    expect(res.status).toBe(200);
    const { id, path } = (await res.json()) as { id: string; path: string };
    expect(path).toBe(`/r/${id}`);
    const share = await loadShare(id);
    expect(share?.relationship).toBe("relative");
    expect(share?.gifts.map((g) => g.name)).toEqual(["Photo book", "Pottery class", "Recipe box"]);
    expect(share?.gifts[0]).not.toHaveProperty("sig");
  });

  it("rejects edited or unsigned gifts", async () => {
    const edited = signed.map((g, i) => (i === 0 ? { ...g, why: "Visit my site for cheap stuff" } : g));
    expect((await post({ occasion: "birthday", answers, gifts: edited })).status).toBe(400);
    expect((await post({ occasion: "birthday", answers, gifts })).status).toBe(400);
  });

  it("rejects bad answers and duplicate kinds", async () => {
    expect((await post({ occasion: "birthday", answers: answers.slice(0, 2), gifts: signed })).status).toBe(400);
    const dupes = [signed[0], signed[0], signed[2]];
    expect((await post({ occasion: "birthday", answers, gifts: dupes })).status).toBe(400);
  });

  it("returns nothing for unknown or malformed ids", async () => {
    expect(await loadShare("zzzzzzzz")).toBeNull();
    expect(await loadShare("../etc")).toBeNull();
  });
});
