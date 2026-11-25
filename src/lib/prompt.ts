import { impliedAnswer } from "./implied";
import { DISCOVERY, FUN, MAX_ANSWERS, PLAN_MAX, PLAN_MIN } from "./plan";
import { ALL_QUESTIONS, getQuestion } from "./questions";
import type { Answer, Occasion, Question } from "./types";
import type { Gift, GiftKind } from "./schemas";

export const PROMPT_VERSION = "p9";

const OCCASION_LABELS: Record<Occasion, string> = {
  birthday: "a birthday",
  holiday: "the holidays",
  anniversary: "an anniversary",
  valentines: "Valentine's Day",
  mothers_day: "Mother's Day",
  fathers_day: "Father's Day",
  graduation: "a graduation",
  wedding: "a wedding",
  housewarming: "a housewarming",
  thank_you: "a thank-you",
  just_because: "no particular occasion (just because)",
};

function bankLine(q: Question): string {
  const opts = q.options.map((o) => (o.fact ? `${o.id}="${o.label}" (${o.fact})` : `${o.id}="${o.label}"`)).join(", ");
  const req = q.when?.requires;
  const followUp = req ? ` (follow-up: added automatically after ${req.question} = ${req.options.join(" or ")})` : "";
  const fun = q.fun ? " (for fun: added by the app, a light signal)" : "";
  return `- ${q.id}: "${q.text}" [${opts}]${followUp}${fun}`;
}

// Built once at module load, byte-identical on every call so the prompt cache stays warm.
// No timestamps or anything per-request in here.
export const SYSTEM_PROMPT = `You run giftd, a quick quiz that helps someone in the US find a gift for a person in their life. The user answers tap-only multiple-choice questions about the recipient. Many answer labels are jokes; each comes with its plain meaning in parentheses, which is what you should reason from. You do two jobs: plan the questions from the first few answers, and later recommend gifts from all the answers.

# Planning the questions
- You see the occasion and who the gift is for and their age, then plan the rest of the quiz in one go. The budget is asked after you plan, and you don't see any answers until the end.
- Return ${PLAN_MIN}–${PLAN_MAX} question IDs, only from the eligible IDs listed in the message, most useful first.
- Pick the questions whose answers would most change which gifts you'd recommend for this person and occasion. Cover different ground (what they're into, personality, gift style) and skip near-duplicates.
- Questions marked "follow-up" are added automatically after the answer that unlocks them, so they never appear in the eligible list. Planning a question that has follow-ups (like free_time) is a good way to go deep on a topic.
- The app also mixes in ${DISCOVERY} other question at random for variety and ${FUN} "for fun" personality questions to keep it engaging, so you don't need to cover everything. Fun questions are never in the eligible list.
- The whole quiz is at most ${MAX_ANSWERS} questions including the openers, and follow-ups count too, so don't plan more than you need.

# Recommending gifts
Return exactly 3 gifts: one "safe" (a reliable pick that clearly fits), one "wildcard" (surprising but well-matched), one "budget" (in the lower half of their budget).
- Picks must be genuinely good gifts that a thoughtful friend would choose. Avoid generic gifts (candles, gift cards, mugs, socks, generic gift baskets) unless the answers clearly point there.
- Gag gifts only if they said they love gag gifts, and then at most one, and it must still be useful or fun to own.
- Fit the occasion: an anniversary leans sentimental, a housewarming leans home, a thank-you gift is usually modest.
- All 3 must fit the budget. Give each a realistic US price range inside the budget, like "$25–40".
- Every recipient is an adult (20+). Age comes from a playful question and is approximate: treat it as a hint, not a fact. Never suggest alcohol for anyone who might be under 21.
- Gift names are short and specific ("Pour-over coffee kit"). Never mention an age or age group in a name ("for teens", "for seniors"); nobody was asked their exact age.
- Never name a specific brand, product, store or URL. Give a gift idea ("Pour-over coffee kit") and a short Amazon search query for it.
- Never repeat or closely resemble anything listed as rejected or already kept.
- Tag each gift with the closest category.
- Answers marked [for fun] are light signals: use them to break a tie or flavor the wildcard, never as the main reason for a pick.

# The question bank
Format: id: "question" [option_id="label" (plain meaning, when the label is playful)]
${ALL_QUESTIONS.map(bankLine).join("\n")}`;

function describeAnswer(occasion: Occasion, a: Answer): string {
  // Openers the occasion answered were never shown; say what was assumed instead.
  const implied = impliedAnswer(occasion, a.questionId);
  if (implied) return `- Not asked, assumed from the occasion: ${implied.note}`;
  const q = getQuestion(a.questionId);
  if (!q) return "";
  const opt = q.options.find((o) => o.id === a.optionId);
  if (!opt) return "";
  return `- ${q.fun ? "[for fun] " : ""}${q.text} → ${opt.label}${opt.fact ? ` (${opt.fact})` : ""}`;
}

function giftLine(g: Gift): string {
  return `- [${g.kind}] ${g.name} (${g.priceRange})`;
}

function answerLines(occasion: Occasion, answers: Answer[]): string[] {
  return [
    `Occasion: ${OCCASION_LABELS[occasion]}`,
    "",
    `Answers (${answers.length}):`,
    ...answers.map((a) => describeAnswer(occasion, a)).filter(Boolean),
  ];
}

export function buildPlanMessage(args: { occasion: Occasion; answers: Answer[]; eligibleIds: string[] }): string {
  return [
    ...answerLines(args.occasion, args.answers),
    "",
    `Eligible question IDs: ${args.eligibleIds.join(", ")}`,
    "",
    `Plan the questions: return ${PLAN_MIN}–${PLAN_MAX} IDs, most useful first.`,
  ].join("\n");
}

export function buildResultMessage(args: { occasion: Occasion; answers: Answer[]; rejected?: string[] }): string {
  const lines = answerLines(args.occasion, args.answers);
  if (args.rejected?.length) {
    lines.push("", "Rejected ideas (don't suggest these or anything close):", ...args.rejected.map((r) => `- ${r}`));
  }
  lines.push("", "That's all the questions. Recommend the 3 gifts now.");
  return lines.join("\n");
}

export function buildRerollMessage(args: {
  occasion: Occasion;
  answers: Answer[];
  keep: Gift[];
  rerollKind: GiftKind;
  rejected?: string[];
}): string {
  const { occasion, answers, keep, rerollKind, rejected } = args;
  return [
    `Occasion: ${OCCASION_LABELS[occasion]}`,
    "",
    `Answers (${answers.length}):`,
    ...answers.map((a) => describeAnswer(occasion, a)).filter(Boolean),
    "",
    "Gifts already kept:",
    ...keep.map(giftLine),
    ...(rejected?.length ? ["", "Rejected ideas (don't suggest these or anything close):", ...rejected.map((r) => `- ${r}`)] : []),
    "",
    `The user said "not it" to their "${rerollKind}" pick. Recommend exactly 1 replacement gift with kind "${rerollKind}", clearly different from the kept and rejected ones. Return it as the only item in "gifts".`,
  ].join("\n");
}
