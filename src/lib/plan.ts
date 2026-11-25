import { conditionsMatch, eligible, isExcluded } from "./eligibility";
import { BANK } from "./questions";
import type { PlanStep } from "./schemas";
import type { Answer, Occasion, PublicQuestion, Question } from "./types";

export { MAX_ANSWERS, nextPlanned, planSequence } from "./plan-walk";

/** Top-level questions the AI should plan (follow-ups are added on top, up to MAX_ANSWERS). */
export const PLAN_MIN = 3;
export const PLAN_MAX = 6;

export const toPublic = (q: Question): PublicQuestion => ({
  id: q.id,
  text: q.text,
  options: q.options.map(({ id, label }) => ({ id, label })),
});

/**
 * Builds the question plan from the AI's ordered picks: drops anything ineligible, repeated or
 * excluded by an earlier pick, tops up from priority order if too few survive, and attaches the
 * rule-based follow-ups each answer unlocks.
 */
export function buildPlan(occasion: Occasion, answers: Answer[], pickedIds: string[]): PlanStep[] {
  const candidates = eligible(occasion, answers);
  const byId = new Map(candidates.map((q) => [q.id, q]));
  const chosen: Question[] = [];
  const taken = new Set(answers.map((a) => a.questionId));

  const add = (q: Question | undefined) => {
    if (!q || chosen.length >= PLAN_MAX || taken.has(q.id) || isExcluded(q, taken)) return;
    chosen.push(q);
    taken.add(q.id);
  };
  for (const id of pickedIds) add(byId.get(id));
  // Too few usable picks (or the AI failed): fill up with the highest-priority questions.
  if (chosen.length < PLAN_MIN) {
    for (const q of [...candidates].sort((a, b) => b.priority - a.priority)) {
      if (chosen.length >= PLAN_MIN) break;
      add(q);
    }
  }
  return chosen.map((q) => stepFor(q, occasion, answers, taken));
}

function stepFor(q: Question, occasion: Occasion, answers: Answer[], taken: Set<string>): PlanStep {
  const followUps: Record<string, PlanStep[]> = {};
  for (const option of q.options) {
    const after = [...answers, { questionId: q.id, optionId: option.id }];
    const steps = BANK.filter(
      (f) =>
        f.when?.requires?.question === q.id &&
        !taken.has(f.id) &&
        !isExcluded(f, taken) &&
        conditionsMatch(f, occasion, after),
    ).map((f) => stepFor(f, occasion, after, new Set([...taken, f.id])));
    if (steps.length) followUps[option.id] = steps;
  }
  return Object.keys(followUps).length ? { question: toPublic(q), followUps } : { question: toPublic(q) };
}
