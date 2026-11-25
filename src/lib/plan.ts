import { ANSWER_EMOJI } from "./emoji";
import { conditionsMatch, eligible, isExcluded } from "./eligibility";
import { BANK } from "./questions";
import type { PlanStep } from "./schemas";
import type { Answer, Occasion, PublicQuestion, Question } from "./types";

export { MAX_ANSWERS, nextPlanned, planSequence } from "./plan-walk";

/** Top-level questions the AI should plan (follow-ups are added on top, up to MAX_ANSWERS). */
export const PLAN_MIN = 4;
export const PLAN_MAX = 6;
/**
 * Extra questions the server adds at random on top of the AI's picks. The AI reliably picks the
 * same strong questions, so without these the rest of the bank (pets, reading, music...) would
 * almost never come up. They also give the click data a spread of questions to learn from.
 */
export const DISCOVERY = 1;
/** Fun personality questions added to every plan, for engagement (see Question.fun). */
export const FUN = 2;
/**
 * Where the extras go, as positions in the final plan, so the quiz alternates useful and fun:
 * useful, fun, useful, discovery, useful, fun, then the rest of the AI's picks.
 */
const DISCOVERY_AT = [3];
const FUN_AT = [1, 5];

export const toPublic = (q: Question): PublicQuestion => ({
  id: q.id,
  text: q.text,
  options: q.options.map(({ id, label, hideFor }) => {
    const emoji = ANSWER_EMOJI[q.id]?.[id];
    return { id, label, ...(emoji && { emoji }), ...(hideFor && { hideFor }) };
  }),
});

/**
 * Builds the question plan from the AI's ordered picks: drops anything ineligible, repeated or
 * excluded by an earlier pick, tops up from priority order if too few survive, and attaches the
 * rule-based follow-ups each answer unlocks.
 */
export function buildPlan(
  occasion: Occasion,
  answers: Answer[],
  pickedIds: string[],
  random: (() => number) | null = null,
): PlanStep[] {
  const all = eligible(occasion, answers);
  const candidates = all.filter((q) => !q.fun);
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
  if (random) {
    // Discovery: questions the AI didn't pick, at random (higher priority = likelier).
    const discovery = drawFrom(candidates, DISCOVERY, (pool) => weightedPick(pool, random));
    // Fun: any fun question, all equally likely.
    const fun = drawFrom(
      all.filter((q) => q.fun),
      FUN,
      (pool) => pool[Math.floor(random() * pool.length)],
    );
    const placed: [number, Question][] = [
      ...discovery.map((q, i) => [DISCOVERY_AT[i] ?? Infinity, q] as [number, Question]),
      ...fun.map((q, i) => [FUN_AT[i] ?? Infinity, q] as [number, Question]),
    ].sort((a, b) => a[0] - b[0]);
    for (const [at, q] of placed) chosen.splice(Math.min(at, chosen.length), 0, q);
  }
  return chosen.map((q) => stepFor(q, occasion, answers, taken));

  /** Picks up to n questions not already taken, marking each as taken. */
  function drawFrom(source: Question[], n: number, pick: (pool: Question[]) => Question): Question[] {
    const out: Question[] = [];
    let pool = source.filter((q) => !taken.has(q.id) && !isExcluded(q, taken));
    while (out.length < n && pool.length) {
      const q = pick(pool);
      out.push(q);
      taken.add(q.id);
      pool = pool.filter((p) => p.id !== q.id && !isExcluded(p, taken));
    }
    return out;
  }
}

function weightedPick(pool: Question[], random: () => number): Question {
  const total = pool.reduce((sum, q) => sum + q.priority, 0);
  let r = random() * total;
  for (const q of pool) {
    r -= q.priority;
    if (r < 0) return q;
  }
  return pool[pool.length - 1];
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
