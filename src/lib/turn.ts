import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { eligible, validateAnswers } from "./eligibility";
import { MAX_ANSWERS, PLAN_MAX, PLAN_MIN, buildPlan } from "./plan";
import { SYSTEM_PROMPT, buildPlanMessage, buildRerollMessage, buildResultMessage } from "./prompt";
import { OPENER_IDS } from "./questions";
import { signGift } from "./sign";
import { Gift, ResultSchema, planSchema } from "./schemas";
import type { GiftKind, TurnRequest, TurnResponse } from "./schemas";

export const QUESTION_MODEL = process.env.GIFTD_MODEL || "claude-haiku-5-5";
export const RESULT_MODEL = process.env.GIFTD_RESULT_MODEL || QUESTION_MODEL;

export const MIN_ANSWERS_FOR_RESULT = 5;
export { MAX_ANSWERS };

const PLAN_MAX_TOKENS = 2000;
const RESULT_MAX_TOKENS = 4000;
const ATTEMPTS = 2; // first try + one retry

export class TurnError extends Error {
  constructor(
    public status: 400 | 502,
    message: string,
  ) {
    super(message);
  }
}

export type TurnHooks = {
  /** Called after every Claude call, e.g. for cost logging in playtests. */
  onUsage?: (usage: Anthropic.Usage, model: string, kind: "plan" | "result") => void;
  onWarn?: (message: string) => void;
};

/** random: for the plan's discovery questions (tests pass a seeded one). */
type Ctx = { client: Anthropic; hooks?: TurnHooks; random?: () => number };

async function callModel<S extends z.ZodType>(
  ctx: Ctx,
  kind: "plan" | "result",
  schema: S,
  message: string,
): Promise<z.infer<S> | null> {
  const model = kind === "plan" ? QUESTION_MODEL : RESULT_MODEL;
  try {
    const res = await ctx.client.messages.parse({
      model,
      max_tokens: kind === "plan" ? PLAN_MAX_TOKENS : RESULT_MAX_TOKENS,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: message }],
      output_config: { effort: "low", format: zodOutputFormat(schema) },
    });
    ctx.hooks?.onUsage?.(res.usage, model, kind);
    if (res.stop_reason !== "end_turn") {
      ctx.hooks?.onWarn?.(`${kind} call stopped with ${res.stop_reason}`);
      return null;
    }
    return (res.parsed_output as z.infer<S> | null) ?? null;
  } catch (err) {
    // The SDK has already retried 429/5xx/connection errors twice by this point.
    if (err instanceof Anthropic.APIError) {
      ctx.hooks?.onWarn?.(`${kind} call failed: ${err.status} ${err.message}`);
      return null;
    }
    ctx.hooks?.onWarn?.(`${kind} call failed: ${String(err)}`);
    return null;
  }
}

/** Validates gifts from Claude: length caps, and exactly the expected kinds, once each. */
export function cleanGifts(raw: unknown[], expectedKinds: GiftKind[], avoidNames: string[] = []): Gift[] | null {
  if (raw.length !== expectedKinds.length) return null;
  const avoid = new Set(avoidNames.map((n) => n.trim().toLowerCase()));
  const gifts: Gift[] = [];
  for (const g of raw) {
    const parsed = Gift.safeParse(g);
    if (!parsed.success) return null;
    if (avoid.has(parsed.data.name.trim().toLowerCase())) return null;
    gifts.push(parsed.data);
  }
  const kinds = gifts.map((g) => g.kind).sort();
  if (kinds.join() !== [...expectedKinds].sort().join()) return null;
  // Stable display order: safe, wildcard, budget
  const order: GiftKind[] = ["safe", "wildcard", "budget"];
  return gifts.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

const newResultId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

function resultResponse(gifts: Gift[]): TurnResponse {
  return { type: "result", resultId: newResultId(), gifts: gifts.map((g) => ({ ...g, sig: signGift(g) })) };
}

async function resultTurn(ctx: Ctx, message: string, expectedKinds: GiftKind[], avoid: string[]): Promise<TurnResponse> {
  for (let i = 0; i < ATTEMPTS; i++) {
    const out = await callModel(ctx, "result", ResultSchema, message);
    const gifts = out && cleanGifts(out.gifts, expectedKinds, avoid);
    if (gifts) return resultResponse(gifts);
    ctx.hooks?.onWarn?.(`result attempt ${i + 1} was invalid`);
  }
  throw new TurnError(502, "Couldn't come up with gifts right now");
}

/** Openers the plan is made from: all but the last one (the budget). */
const PLAN_OPENER_COUNT = OPENER_IDS.length - 1;

export async function runTurn(req: TurnRequest, ctx: Ctx): Promise<TurnResponse> {
  const { occasion, answers } = req;
  const invalid = validateAnswers(occasion, answers, req.mode === "plan" ? PLAN_OPENER_COUNT : undefined);
  if (invalid) throw new TurnError(400, invalid);
  const rejected = req.rejected ?? [];
  const allKinds: GiftKind[] = ["safe", "wildcard", "budget"];

  if (req.mode === "plan") {
    // Planned from who and age only, so the call can run while the user picks a budget.
    if (answers.length !== PLAN_OPENER_COUNT) throw new TurnError(400, "plan comes right after who and age");
    // Fun questions are added by the server (buildPlan), not planned by the AI.
    const candidates = eligible(occasion, answers).filter((q) => !q.fun);
    let picked: string[] = [];
    if (candidates.length > 0) {
      const ids = candidates.map((q) => q.id) as [string, ...string[]];
      const message = buildPlanMessage({ occasion, answers, eligibleIds: ids });
      for (let i = 0; i < ATTEMPTS && picked.length < PLAN_MIN; i++) {
        picked = (await callModel(ctx, "plan", planSchema(ids), message))?.questionIds ?? [];
        if (picked.length < PLAN_MIN) ctx.hooks?.onWarn?.(`plan attempt ${i + 1} returned ${picked.length} questions`);
      }
    }
    // buildPlan drops bad picks and tops up from priority order, so the quiz never stalls.
    const steps = buildPlan(occasion, answers, picked.slice(0, PLAN_MAX), ctx.random ?? Math.random);
    if (steps.length === 0) throw new TurnError(502, "No questions to ask");
    return { type: "plan", steps };
  }

  if (req.mode === "reroll") {
    const keep = req.keep ?? [];
    const kind = req.rerollKind!;
    const message = buildRerollMessage({ occasion, answers, keep, rerollKind: kind, rejected });
    return resultTurn(ctx, message, [kind], [...rejected, ...keep.map((g) => g.name)]);
  }

  if (answers.length < MIN_ANSWERS_FOR_RESULT) throw new TurnError(400, `need at least ${MIN_ANSWERS_FOR_RESULT} answers`);
  return resultTurn(ctx, buildResultMessage({ occasion, answers, rejected }), allKinds, rejected);
}
