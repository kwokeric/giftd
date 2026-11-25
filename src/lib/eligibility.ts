import { BANK, OPENER_IDS, getQuestion } from "./questions";
import { impliedAnswer } from "./implied";
import { AGE_BANDS, RELATIONSHIPS } from "./types";
import type { AgeBand, Answer, Occasion, Question, Relationship } from "./types";

const ageIndex = (a: AgeBand) => AGE_BANDS.indexOf(a);

function knownAge(answers: Answer[]): AgeBand | null {
  const a = answers.find((x) => x.questionId === "age")?.optionId;
  return a && (AGE_BANDS as readonly string[]).includes(a) ? (a as AgeBand) : null;
}

function knownRelationship(answers: Answer[]): Relationship | null {
  const r = answers.find((x) => x.questionId === "relationship")?.optionId;
  return r && (RELATIONSHIPS as readonly string[]).includes(r) ? (r as Relationship) : null;
}

/**
 * Is `q` askable given what's known? Every `when` condition must match. The openers can't be
 * skipped, so age and relationship are always known by the time bank questions are picked;
 * if they're somehow missing, age/relationship conditions fail closed.
 */
export function conditionsMatch(q: Question, occasion: Occasion, answers: Answer[]): boolean {
  const w = q.when;
  if (!w) return true;

  const age = knownAge(answers);
  if (w.minAge && (age === null || ageIndex(age) < ageIndex(w.minAge))) return false;
  if (w.maxAge && (age === null || ageIndex(age) > ageIndex(w.maxAge))) return false;

  const rel = knownRelationship(answers);
  if (w.relationship && (rel === null || !w.relationship.includes(rel))) return false;
  if (w.notRelationship && (rel === null || w.notRelationship.includes(rel))) return false;

  if (w.occasion && !w.occasion.includes(occasion)) return false;

  if (w.requires) {
    const given = answers.find((x) => x.questionId === w.requires!.question)?.optionId;
    if (!given || !w.requires.options.includes(given)) return false;
  }
  return true;
}

function isExcluded(q: Question, asked: Set<string>): boolean {
  if (q.excludes?.some((id) => asked.has(id))) return true;
  // excludes apply both ways
  for (const id of asked) {
    if (getQuestion(id)?.excludes?.includes(q.id)) return true;
  }
  return false;
}

/** Bank questions that may be asked next, in bank order. */
export function eligible(occasion: Occasion, answers: Answer[], bank: Question[] = BANK): Question[] {
  const asked = new Set(answers.map((a) => a.questionId));
  return bank.filter((q) => !asked.has(q.id) && !isExcluded(q, asked) && conditionsMatch(q, occasion, answers));
}

/** Highest-priority eligible question (ties keep bank order). Used when Claude is unavailable. */
export function fallbackQuestion(candidates: Question[]): Question | undefined {
  return candidates.reduce<Question | undefined>((best, q) => (!best || q.priority > best.priority ? q : best), undefined);
}

/**
 * Checks a client-supplied answer list: openers first and in order, real question/option IDs,
 * no repeats, and every bank question was actually eligible when it was asked.
 * Returns an error message, or null when valid.
 */
export function validateAnswers(occasion: Occasion, answers: Answer[]): string | null {
  if (answers.length < OPENER_IDS.length) return "answers must include the 3 openers";
  for (let i = 0; i < OPENER_IDS.length; i++) {
    if (answers[i].questionId !== OPENER_IDS[i]) return `answer ${i + 1} must be "${OPENER_IDS[i]}"`;
  }
  const seen = new Set<string>();
  for (let i = 0; i < answers.length; i++) {
    const { questionId, optionId } = answers[i];
    const q = getQuestion(questionId);
    if (!q) return `unknown question "${questionId}"`;
    if (seen.has(questionId)) return `question "${questionId}" answered twice`;
    const option = q.options.find((opt) => opt.id === optionId);
    if (!option) return `unknown option "${optionId}" for "${questionId}"`;
    const implied = i < OPENER_IDS.length ? impliedAnswer(occasion, questionId) : undefined;
    if (implied && implied.optionId !== optionId) return `"${questionId}" is set by the occasion`;
    const rel = knownRelationship(answers.slice(0, i));
    if (rel && option.hideFor?.includes(rel)) return `option "${optionId}" isn't offered for a ${rel}`;
    if (i >= OPENER_IDS.length && !eligible(occasion, answers.slice(0, i)).some((e) => e.id === questionId)) {
      return `question "${questionId}" was not eligible at position ${i + 1}`;
    }
    seen.add(questionId);
  }
  return null;
}
