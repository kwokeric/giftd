import { impliedAnswer } from "./implied";
import { ALL_QUESTIONS, getQuestion } from "./questions";
import type { Answer, Occasion, Question } from "./types";
import type { Gift, GiftKind } from "./schemas";

export const PROMPT_VERSION = "p4";

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
  return `- ${q.id}: "${q.text}" [${opts}]`;
}

// Built once at module load, byte-identical on every call so the prompt cache stays warm.
// No timestamps or anything per-request in here.
export const SYSTEM_PROMPT = `You run giftd, a quick quiz that helps someone in the US find a gift for a person in their life. The user answers tap-only multiple-choice questions about the recipient. Many answer labels are jokes; each comes with its plain meaning in parentheses, which is what you should reason from. Each turn you either choose the next question to ask, or recommend gifts.

# Choosing the next question
- Pick only from the eligible question IDs listed in the message.
- Pick the question whose answer would most change which gifts you'd recommend. Prefer following up on a strong signal over starting a new topic.
- Report "confidence" (0–1): how sure you are that you could pick 3 gifts the user would be happy with right now.

# Recommending gifts
Return exactly 3 gifts: one "safe" (a reliable pick that clearly fits), one "wildcard" (surprising but well-matched), one "budget" (in the lower half of their budget).
- Picks must be genuinely good gifts that a thoughtful friend would choose. Avoid generic gifts (candles, gift cards, mugs, socks, generic gift baskets) unless the answers clearly point there.
- Gag gifts only if they said they love gag gifts, and then at most one, and it must still be useful or fun to own.
- Fit the occasion: an anniversary leans sentimental, a housewarming leans home, a thank-you gift is usually modest.
- All 3 must fit the budget. Give each a realistic US price range inside the budget, like "$25–40".
- Age comes from a playful question and is approximate: treat it as a strong hint, not a fact. Never suggest alcohol for anyone who might be under 21.
- Never name a specific brand, product, store or URL. Give a gift idea ("Pour-over coffee kit") and a short Amazon search query for it.
- Never repeat or closely resemble anything listed as rejected or already kept.
- Tag each gift with the closest category.

# Voice for the "why" line
One sentence, warm and a little funny, like a friend who knows them. Prefer a specific observation tied to their answers over hype ("For someone who groans when they sit down: a chair that deserves them."). PG. Tease the situation, never the giver or the recipient. No memes or slang. The voice never makes a pick worse.

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
  return `- ${q.text} → ${opt.label}${opt.fact ? ` (${opt.fact})` : ""}`;
}

function giftLine(g: Gift): string {
  return `- [${g.kind}] ${g.name} (${g.priceRange})`;
}

export function buildTurnMessage(args: {
  occasion: Occasion;
  answers: Answer[];
  eligibleIds: string[];
  allowed: "ask" | "result" | "either";
  rejected?: string[];
}): string {
  const { occasion, answers, eligibleIds, allowed, rejected } = args;
  const lines = [
    `Occasion: ${OCCASION_LABELS[occasion]}`,
    "",
    `Answers so far (${answers.length}):`,
    ...answers.map((a) => describeAnswer(occasion, a)).filter(Boolean),
  ];
  if (rejected?.length) lines.push("", "Rejected ideas (don't suggest these or anything close):", ...rejected.map((r) => `- ${r}`));

  lines.push("");
  if (allowed === "ask") {
    lines.push(`Eligible question IDs: ${eligibleIds.join(", ")}`, "", "Choose the next question to ask.");
  } else if (allowed === "result") {
    lines.push("No more questions. Recommend the 3 gifts now.");
  } else {
    lines.push(
      `Eligible question IDs: ${eligibleIds.join(", ")}`,
      "",
      "Either choose the next question, or recommend the 3 gifts now if your confidence is 0.8 or higher. Fewer questions is better when you already know enough.",
    );
  }
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
