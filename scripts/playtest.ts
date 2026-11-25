/**
 * Persona playtest: a second Claude call plays the quiz as someone shopping for each persona.
 * Same flow as the app: one plan call, the planned questions, one result call.
 * Logs the plan, questions asked, picks, cost and latency.
 *
 *   npm run playtest                 # all personas
 *   npm run playtest -- --only 3     # first 3 personas
 *   npm run playtest -- --pick 5     # just persona #5
 *
 * Needs ANTHROPIC_API_KEY in the environment or in .env.local. Costs about $0.01 per persona.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { OPENERS, getQuestion } from "../src/lib/questions";
import { PROMPT_VERSION } from "../src/lib/prompt";
import type { Gift, TurnResponse } from "../src/lib/schemas";
import { QUESTION_MODEL, RESULT_MODEL, runTurn } from "../src/lib/turn";
import { nextPlanned } from "../src/lib/plan-walk";
import { impliedAnswer } from "../src/lib/implied";
import type { Answer, Occasion, Question } from "../src/lib/types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local; rely on the environment
}

type Persona = { occasion: Occasion; who: string };

const PERSONAS: Persona[] = [
  { occasion: "fathers_day", who: "My dad, 62. Golf-obsessed, has everything, buys what he wants himself. Budget $50–100." },
  { occasion: "mothers_day", who: "My mom, 58. Lives in her garden, very sentimental, keeps every card I've ever given her. Budget $25–50." },
  { occasion: "valentines", who: "My girlfriend of 8 months, 26. Coffee snob, listens to true crime podcasts, loves trying new restaurants. Budget $50–100." },
  { occasion: "anniversary", who: "My husband, 44. We've been married 12 years. He's the cook at home and loves grilling. Budget $100–250." },
  { occasion: "holiday", who: "A coworker I barely know, early 30s, for the office gift exchange. Seems into running. Budget under $25." },
  { occasion: "birthday", who: "My nephew, 8. Obsessed with Lego and dinosaurs, reads a lot. Budget $25–50." },
  { occasion: "birthday", who: "My niece, 15. Into makeup, pop music and her phone. Rolls her eyes at everything I say. Budget $25–50." },
  { occasion: "holiday", who: "My grandma, 83. Homebody, does crosswords every morning, loves her cat. Budget $25–50." },
  { occasion: "housewarming", who: "My best friend, 27, just moved into their first apartment with no furniture to speak of. Budget $25–50." },
  { occasion: "graduation", who: "My cousin, 22, graduating college and moving to Chicago for their first job. Budget $50–100." },
  { occasion: "wedding", who: "My friend's wedding. The couple is in their 30s and loves hiking and camping. Budget $100–250." },
  { occasion: "birthday", who: "My brother, 33. PC gamer, introvert, works from home. Budget $50–100." },
  { occasion: "thank_you", who: "My neighbor, around 50, who watered my plants for two weeks. Friendly but I don't know them well. Budget under $25." },
  { occasion: "just_because", who: "My wife, 34, who had our first baby 2 months ago. She's exhausted. Budget $50–100." },
  { occasion: "holiday", who: "My boss, 55. Loves wine and talks about his travels constantly. Budget $25–50." },
  { occasion: "birthday", who: "My sister, 29. Very bougie, obsessed with skincare, only buys the nice version of everything. Budget $100–250." },
  { occasion: "birthday", who: "My grandpa, 76. Still very active, has a woodworking shop in the garage. Budget $50–100." },
  { occasion: "birthday", who: "My friend, 41. Impossible to shop for, a minimalist who hates clutter. Budget $50–100." },
  { occasion: "holiday", who: "My dad, 57. Avoids tech, still plays his classic rock vinyl, old soul. Budget $100–250." },
  { occasion: "birthday", who: "My roommate, 24. Plant parent, broke, loves a good gag gift. Budget under $25." },
];

// --- args -------------------------------------------------------------------
const args = process.argv.slice(2);
const argNum = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? Number(args[i + 1]) : undefined;
};
const only = argNum("--only");
const pick = argNum("--pick");
const personas = pick ? [PERSONAS[pick - 1]] : PERSONAS.slice(0, only ?? PERSONAS.length);

// --- cost tracking (Haiku 5.5 rates per million tokens; update if models change) ---
const RATES: Record<string, { in: number; out: number }> = {
  "claude-haiku-5-5": { in: 0.1, out: 0.5 },
  "claude-sonnet-5-5": { in: 2, out: 10 },
};
function costOf(u: Anthropic.Usage, model: string): number {
  const r = RATES[model] ?? RATES["claude-haiku-5-5"];
  const cacheWrite = (u.cache_creation_input_tokens ?? 0) * r.in * 1.25;
  const cacheRead = (u.cache_read_input_tokens ?? 0) * r.in * 0.1;
  return (u.input_tokens * r.in + cacheWrite + cacheRead + u.output_tokens * r.out) / 1e6;
}

// --- the persona "player" -------------------------------------------------------
const client = new Anthropic();

async function personaAnswers(p: Persona, q: Question | { id: string; text: string; options: { id: string; label: string }[] }): Promise<string> {
  const ids = q.options.map((o) => o.id) as [string, ...string[]];
  const res = await client.messages.parse({
    model: "claude-haiku-5-5",
    max_tokens: 1000,
    output_config: { effort: "low", format: zodOutputFormat(z.object({ optionId: z.enum(ids) })) },
    messages: [
      {
        role: "user",
        content: [
          "You're testing a gift-finder quiz. Play someone shopping for this person:",
          p.who,
          "",
          `Quiz question: "${q.text}"`,
          ...q.options.map((o) => `- ${o.id}: ${o.label}`),
          "",
          "Answer as the shopper would: pick the option that fits best, even if none is perfect.",
        ].join("\n"),
      },
    ],
  });
  const picked = res.parsed_output?.optionId;
  if (!picked) throw new Error(`persona couldn't answer "${q.text}" (${res.stop_reason})`);
  return picked;
}

const budgetMax: Record<string, number> = { under_25: 25, "25_50": 50, "50_100": 100, "100_250": 250, "250_plus": Infinity };
function overBudget(g: Gift, budget: string | undefined): boolean {
  const max = budget ? budgetMax[budget] : undefined;
  if (!max || max === Infinity) return false;
  const nums = (g.priceRange.match(/\d+/g) ?? []).map(Number);
  return nums.length > 0 && Math.max(...nums) > max * 1.1;
}

// --- run ------------------------------------------------------------------------
type Log = {
  persona: string;
  occasion: Occasion;
  plan: string[];
  asked: string[];
  questionCount: number;
  gifts: Gift[];
  overBudget: string[];
  warnings: string[];
  costUsd: number;
  turnMs: number[];
  error?: string;
};

async function play(p: Persona): Promise<Log> {
  const log: Log = { persona: p.who, occasion: p.occasion, plan: [], asked: [], questionCount: 0, gifts: [], overBudget: [], warnings: [], costUsd: 0, turnMs: [] };
  const answers: Answer[] = [];
  const hooks = {
    onUsage: (u: Anthropic.Usage, model: string) => (log.costUsd += costOf(u, model)),
    onWarn: (m: string) => log.warnings.push(m),
  };

  for (const q of OPENERS) {
    // Like the app: openers the occasion answers are filled in, not asked.
    const optionId = impliedAnswer(p.occasion, q.id)?.optionId ?? (await personaAnswers(p, q));
    answers.push({ questionId: q.id, optionId });
    log.asked.push(`${q.id}=${optionId}`);
  }

  // Same flow as the app: one plan call, walk the plan locally, one result call.
  const call = async (mode: "plan" | "result"): Promise<TurnResponse | null> => {
    const t0 = Date.now();
    try {
      return await runTurn({ occasion: p.occasion, answers, mode }, { client, hooks });
    } catch (err) {
      log.error = String(err);
      return null;
    } finally {
      log.turnMs.push(Date.now() - t0);
    }
  };

  const plan = await call("plan");
  if (plan?.type === "plan") {
    log.plan = plan.steps.map((s) => s.question.id);
    for (let q = nextPlanned(plan.steps, answers); q; q = nextPlanned(plan.steps, answers)) {
      const optionId = await personaAnswers(p, getQuestion(q.id)!);
      answers.push({ questionId: q.id, optionId });
      log.asked.push(`${q.id}=${optionId}`);
    }
    const result = await call("result");
    if (result?.type === "result") log.gifts = result.gifts;
  }

  log.questionCount = answers.length;
  const budget = answers.find((a) => a.questionId === "budget")?.optionId;
  log.overBudget = log.gifts.filter((g) => overBudget(g, budget)).map((g) => `${g.name} (${g.priceRange})`);
  return log;
}

function percentile(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set. Add it to .env.local or your environment.");
    process.exit(1);
  }
  console.log(`giftd playtest · ${personas.length} personas · question model ${QUESTION_MODEL} · result model ${RESULT_MODEL} · prompt ${PROMPT_VERSION}\n`);

  const logs: Log[] = [];
  for (const [i, p] of personas.entries()) {
    const log = await play(p);
    logs.push(log);
    console.log(`#${i + 1} [${p.occasion}] ${p.who}`);
    console.log(`   plan: ${log.plan.join(", ")}`);
    console.log(`   asked (${log.questionCount}): ${log.asked.join(" → ")}`);
    for (const g of log.gifts) console.log(`   ${g.kind.padEnd(8)} ${g.name} · ${g.priceRange} · ${g.category}\n            "${g.why}"`);
    if (log.overBudget.length) console.log(`   ⚠ over budget: ${log.overBudget.join(", ")}`);
    if (log.warnings.length) console.log(`   ⚠ ${log.warnings.join(" | ")}`);
    if (log.error) console.log(`   ✗ ${log.error}`);
    console.log(`   $${log.costUsd.toFixed(4)} · turns ${log.turnMs.map((ms) => (ms / 1000).toFixed(1) + "s").join(", ")}\n`);
  }

  const done = logs.filter((l) => l.gifts.length === 3);
  const allMs = logs.flatMap((l) => l.turnMs);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1);
  console.log("— Summary —");
  console.log(`completed: ${done.length}/${logs.length}`);
  console.log(`avg questions: ${avg(done.map((l) => l.questionCount)).toFixed(1)} (min ${Math.min(...done.map((l) => l.questionCount))}, max ${Math.max(...done.map((l) => l.questionCount))})`);
  console.log(`avg cost per quiz (quiz calls only, excludes persona answers): $${avg(logs.map((l) => l.costUsd)).toFixed(4)}`);
  console.log(`turn latency p50 ${(percentile(allMs, 50) / 1000).toFixed(1)}s · p90 ${(percentile(allMs, 90) / 1000).toFixed(1)}s`);
  console.log(`over-budget picks: ${logs.reduce((n, l) => n + l.overBudget.length, 0)}`);
  console.log(`quizzes with warnings: ${logs.filter((l) => l.warnings.length).length}`);

  mkdirSync("playtest-results", { recursive: true });
  const file = `playtest-results/${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(file, JSON.stringify({ promptVersion: PROMPT_VERSION, questionModel: QUESTION_MODEL, resultModel: RESULT_MODEL, logs }, null, 2));
  console.log(`\nfull log: ${file}`);
}

void main();
