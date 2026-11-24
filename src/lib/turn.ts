import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { eligible, fallbackQuestion, validateAnswers } from "./eligibility";
import { SYSTEM_PROMPT, buildRerollMessage, buildTurnMessage } from "./prompt";
import { Gift, ResultSchema, askSchema, eitherSchema } from "./schemas";
import type { GiftKind, TurnRequest, TurnResponse } from "./schemas";
import type { Question } from "./types";

export const QUESTION_MODEL = process.env.GIFTD_MODEL || "claude-haiku-5-5";
export const RESULT_MODEL = process.env.GIFTD_RESULT_MODEL || QUESTION_MODEL;

export const MIN_ANSWERS_FOR_RESULT = 5;
export const MAX_ANSWERS = 10;
export const CONFIDENCE_TO_FINISH = 0.8;

const ASK_MAX_TOKENS = 2000;
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
  onUsage?: (usage: Anthropic.Usage, model: string, kind: "ask" | "result") => void;
  onWarn?: (message: string) => void;
};

type Ctx = { client: Anthropic; hooks?: TurnHooks };

async function callModel<S extends z.ZodType>(
  ctx: Ctx,
  kind: "ask" | "result",
  schema: S,
  message: string,
): Promise<z.infer<S> | null> {
  const model = kind === "ask" ? QUESTION_MODEL : RESULT_MODEL;
  try {
    const res = await ctx.client.messages.parse({
      model,
      max_tokens: kind === "ask" ? ASK_MAX_TOKENS : RESULT_MAX_TOKENS,
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

function questionResponse(q: Question, index: number): TurnResponse {
  return {
    type: "question",
    question: { id: q.id, text: q.text, options: q.options.map(({ id, label }) => ({ id, label })) },
    index,
  };
}

const newResultId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

async function resultTurn(ctx: Ctx, message: string, expectedKinds: GiftKind[], avoid: string[]): Promise<TurnResponse> {
  for (let i = 0; i < ATTEMPTS; i++) {
    const out = await callModel(ctx, "result", ResultSchema, message);
    const gifts = out && cleanGifts(out.gifts, expectedKinds, avoid);
    if (gifts) return { type: "result", resultId: newResultId(), gifts };
    ctx.hooks?.onWarn?.(`result attempt ${i + 1} was invalid`);
  }
  throw new TurnError(502, "Couldn't come up with gifts right now");
}

export async function runTurn(req: TurnRequest, ctx: Ctx): Promise<TurnResponse> {
  const { occasion, answers } = req;
  const invalid = validateAnswers(occasion, answers);
  if (invalid) throw new TurnError(400, invalid);

  const rejected = req.rejected ?? [];

  if (req.mode === "reroll") {
    const keep = req.keep ?? [];
    const kind = req.rerollKind!;
    const message = buildRerollMessage({ occasion, answers, keep, rerollKind: kind, rejected });
    return resultTurn(ctx, message, [kind], [...rejected, ...keep.map((g) => g.name)]);
  }

  const n = answers.length;
  const candidates = eligible(occasion, answers);
  const ids = candidates.map((q) => q.id);
  const allowed: "ask" | "result" | "either" =
    n >= MAX_ANSWERS || ids.length === 0 ? "result" : n < MIN_ANSWERS_FOR_RESULT ? "ask" : "either";

  const resultMessage = () => buildTurnMessage({ occasion, answers, eligibleIds: [], allowed: "result", rejected });
  const allKinds: GiftKind[] = ["safe", "wildcard", "budget"];

  if (allowed === "result") return resultTurn(ctx, resultMessage(), allKinds, rejected);

  const idTuple = ids as [string, ...string[]];
  const message = buildTurnMessage({ occasion, answers, eligibleIds: ids, allowed, rejected });

  for (let i = 0; i < ATTEMPTS; i++) {
    const out =
      allowed === "ask"
        ? await callModel(ctx, "ask", askSchema(idTuple), message)
        : (await callModel(ctx, "ask", eitherSchema(idTuple), message))?.turn;
    if (!out) continue;

    if (out.action === "ask") {
      const q = candidates.find((c) => c.id === out.questionId);
      if (!q) {
        ctx.hooks?.onWarn?.(`ineligible question id ${out.questionId}`);
        continue;
      }
      // The model said it's confident enough: finish instead of asking.
      if (allowed === "either" && out.confidence >= CONFIDENCE_TO_FINISH) {
        return resultTurn(ctx, resultMessage(), allKinds, rejected);
      }
      return questionResponse(q, n + 1);
    }

    if (out.action === "result" && allowed === "either") {
      const gifts = cleanGifts(out.gifts, allKinds, rejected);
      if (gifts) return { type: "result", resultId: newResultId(), gifts };
      ctx.hooks?.onWarn?.("inline result was invalid");
    }
  }

  // Claude failed twice on a question turn: never break the quiz, ask the top-priority question.
  ctx.hooks?.onWarn?.("falling back to highest-priority eligible question");
  return questionResponse(fallbackQuestion(candidates)!, n + 1);
}
