import { validateAnswers } from "@/lib/eligibility";
import { Gift, ShareRequest } from "@/lib/schemas";
import { saveShare, sharingAvailable } from "@/lib/shares";
import { signingEnabled, verifyGift } from "@/lib/sign";
import { RELATIONSHIPS } from "@/lib/types";
import type { Relationship } from "@/lib/types";

// TODO (Phase 4): per-IP rate limit (10 shares per hour) with Upstash.

export async function POST(request: Request) {
  if (!sharingAvailable() || !signingEnabled()) {
    return Response.json({ error: "Sharing isn't set up yet" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = ShareRequest.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { occasion, answers, gifts } = parsed.data;

  const invalid = validateAnswers(occasion, answers);
  if (invalid) return Response.json({ error: invalid }, { status: 400 });

  // One of each kind, and every gift must be one giftd generated.
  const kinds = gifts.map((g) => g.kind).sort().join();
  if (kinds !== "budget,safe,wildcard") return Response.json({ error: "Invalid gifts" }, { status: 400 });
  if (!gifts.every((g) => g.sig && verifyGift(g, g.sig))) {
    return Response.json({ error: "Invalid gifts" }, { status: 400 });
  }

  const rel = answers.find((a) => a.questionId === "relationship")?.optionId;
  const relationship = (RELATIONSHIPS as readonly string[]).includes(rel ?? "") ? (rel as Relationship) : null;
  const order = ["safe", "wildcard", "budget"];
  const cleanGifts: Gift[] = gifts
    .map((g) => Gift.parse(g)) // drops `sig`
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));

  try {
    const id = await saveShare({
      v: 1,
      occasion,
      relationship,
      answers,
      gifts: cleanGifts,
      createdAt: new Date().toISOString(),
    });
    return Response.json({ id, path: `/r/${id}` });
  } catch (err) {
    console.error("[share] save failed", err);
    return Response.json({ error: "Couldn't save the link" }, { status: 502 });
  }
}
