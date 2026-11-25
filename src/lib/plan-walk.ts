// Walking a question plan. Client-safe: no question bank (and none of its hidden facts) here.
import type { PlanStep } from "./schemas";
import type { Answer, PublicQuestion } from "./types";

export const MAX_ANSWERS = 12;

/**
 * The questions to ask, in order, given the plan and the answers so far: each planned question,
 * then the follow-ups its chosen answer unlocked. Used by the client to find the next question.
 */
export function planSequence(steps: PlanStep[], answers: Answer[]): PublicQuestion[] {
  const picked = new Map(answers.map((a) => [a.questionId, a.optionId]));
  const out: PublicQuestion[] = [];
  const walk = (list: PlanStep[]) => {
    for (const s of list) {
      out.push(s.question);
      const choice = picked.get(s.question.id);
      if (choice && s.followUps?.[choice]) walk(s.followUps[choice]);
    }
  };
  walk(steps);
  return out;
}

/** The next unanswered planned question, or null when it's time for the gifts. */
export function nextPlanned(steps: PlanStep[], answers: Answer[]): PublicQuestion | null {
  if (answers.length >= MAX_ANSWERS) return null;
  const asked = new Set(answers.map((a) => a.questionId));
  return planSequence(steps, answers).find((q) => !asked.has(q.id)) ?? null;
}
