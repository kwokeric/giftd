import { describe, expect, it } from "vitest";
import { kv } from "./kv";
import { LIMITS, clientIp, overLimit } from "./rate-limit";

const from = (ip: string) => new Headers({ "x-forwarded-for": `${ip}, 10.0.0.1` });
const HOUR = 60 * 60 * 1000;

describe("rate limits", () => {
  it("lets the first requests through, then blocks, per IP and per hour", async () => {
    const now = Date.UTC(2026, 10, 26, 12, 5);
    for (let i = 0; i < LIMITS.share.max; i++) expect(await overLimit("share", from("1.1.1.1"), now)).toBe(false);
    expect(await overLimit("share", from("1.1.1.1"), now)).toBe(true);
    // Someone else, and the same person next hour, start fresh
    expect(await overLimit("share", from("2.2.2.2"), now)).toBe(false);
    expect(await overLimit("share", from("1.1.1.1"), now + HOUR)).toBe(false);
    // Limits are separate per endpoint
    expect(await overLimit("turn", from("1.1.1.1"), now)).toBe(false);
  });

  it("reads the visitor's IP, not a proxy's", () => {
    expect(clientIp(from("3.3.3.3"))).toBe("3.3.3.3");
    expect(clientIp(new Headers({ "x-real-ip": "4.4.4.4", "x-forwarded-for": "5.5.5.5" }))).toBe("4.4.4.4");
    expect(clientIp(new Headers())).toBe("unknown");
  });

  it("stores IPs hashed, never as they are", async () => {
    await overLimit("turn", from("6.6.6.6"));
    const g = globalThis as { __giftdMemory?: Map<string, unknown> };
    const keys = [...(g.__giftdMemory?.keys() ?? [])];
    expect(keys.some((k) => k.startsWith("rl:turn:"))).toBe(true);
    expect(keys.some((k) => k.includes("6.6.6.6"))).toBe(false);
  });

  it("expires stored values in the dev store", async () => {
    const store = kv()!;
    await store.set("tmp", { a: 1 }, 0);
    expect(await store.get("tmp")).toBeNull();
  });
});
