import type { Occasion } from "./types";

/**
 * Openers the occasion already answers, so the user never sees them. A skipped question beats a
 * slightly better age guess. The answer is still recorded (openers stay required and in order),
 * and Claude is told it was assumed rather than picked.
 */
export type Implied = { optionId: string; note: string };

const IMPLIED: Partial<Record<Occasion, Partial<Record<"relationship" | "age", Implied>>>> = {
  mothers_day: {
    relationship: { optionId: "relative", note: "their mom (it's Mother's Day)" },
    age: { optionId: "50s_60s", note: "assumed 50+ from the occasion" },
  },
  fathers_day: {
    relationship: { optionId: "relative", note: "their dad (it's Father's Day)" },
    age: { optionId: "50s_60s", note: "assumed 50+ from the occasion" },
  },
  valentines: {
    relationship: { optionId: "partner", note: "their partner (it's Valentine's Day)" },
  },
  graduation: {
    age: { optionId: "20s", note: "a new graduate, probably in their 20s" },
  },
  wedding: {
    age: { optionId: "30s_40s", note: "assumed late 20s to 40s from the occasion" },
  },
  housewarming: {
    age: { optionId: "30s_40s", note: "assumed late 20s to 40s from the occasion" },
  },
};

export function impliedAnswer(occasion: Occasion, questionId: string): Implied | undefined {
  return IMPLIED[occasion]?.[questionId as "relationship" | "age"];
}
