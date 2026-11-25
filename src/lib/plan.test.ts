import { describe, expect, it } from "vitest";
import { validateAnswers } from "./eligibility";
import { DISCOVERY, FUN, MAX_ANSWERS, PLAN_MIN, buildPlan, nextPlanned, planSequence } from "./plan";
import { getQuestion } from "./questions";
import type { PlanStep } from "./schemas";
import type { Answer } from "./types";

const openers = (relationship: string, age: string, budget = "50_100"): Answer[] => [
  { questionId: "relationship", optionId: relationship },
  { questionId: "age", optionId: age },
  { questionId: "budget", optionId: budget },
];
const ids = (steps: PlanStep[]) => steps.map((s) => s.question.id);

/** Answers every planned question with its first option (or a chosen one), like a user would. */
function walk(steps: PlanStep[], start: Answer[], choose: Record<string, string> = {}): Answer[] {
  const answers = [...start];
  for (let q = nextPlanned(steps, answers); q; q = nextPlanned(steps, answers)) {
    answers.push({ questionId: q.id, optionId: choose[q.id] ?? q.options[0].id });
  }
  return answers;
}

/** A small seeded random, so discovery picks are repeatable in tests. */
function seeded(seed: number) {
  // mulberry32
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

describe("question plan", () => {
  it("keeps the AI's order and drops ineligible, repeated and follow-up picks", () => {
    const base = openers("friend", "30s_40s");
    const steps = buildPlan("birthday", base, ["pets", "kid_interest", "pets", "active_type", "free_time", "humor", "travel"]);
    expect(ids(steps)).toEqual(["pets", "free_time", "humor", "travel"]);
  });

  it("tops up from priority order when the AI gives too few (or nothing)", () => {
    const base = openers("friend", "30s_40s");
    expect(buildPlan("birthday", base, ["pets"]).length).toBe(PLAN_MIN);
    expect(ids(buildPlan("birthday", base, []))).toContain("free_time"); // priority 10
  });


  it("attaches follow-ups to the answers that unlock them, two levels deep", () => {
    const steps = buildPlan("birthday", openers("friend", "20s"), ["free_time", "pets", "humor"]);
    const free = steps[0];
    expect(free.followUps?.active?.map((s) => s.question.id)).toEqual(["active_type"]);
    const media = free.followUps?.media?.[0];
    expect(media?.question.id).toBe("media_type");
    expect(media?.followUps?.games?.[0].question.id).toBe("gaming_platform");
    expect(free.followUps?.social).toBeDefined();
  });

  it("asks follow-ups right after their question, and only for the matching answer", () => {
    const base = openers("friend", "20s");
    const steps = buildPlan("birthday", base, ["free_time", "pets", "humor", "travel"]);
    const gamer = walk(steps, base, { free_time: "media", media_type: "games" });
    expect(gamer.slice(3).map((a) => a.questionId)).toEqual(["free_time", "media_type", "gaming_platform", "pets", "humor", "travel"]);
    const cook = walk(steps, base, { free_time: "cooking" });
    expect(cook.slice(3).map((a) => a.questionId)).toEqual(["free_time", "cooking_type", "pets", "humor", "travel"]);
  });

  it("leads from style to clothes, and asks about size only for sized things", () => {
    const base = openers("friend", "20s");
    const steps = buildPlan("birthday", base, ["style", "pets", "humor", "travel"]);
    const sneakers = walk(steps, base, { style: "minimal", wardrobe: "shoes" });
    expect(sneakers.slice(3, 6).map((a) => a.questionId)).toEqual(["style", "wardrobe", "size_known"]);
    const jewelry = walk(steps, base, { style: "bold", wardrobe: "jewelry" });
    expect(jewelry.map((a) => a.questionId)).not.toContain("size_known");
    const none = walk(steps, base, { style: "none" });
    expect(none.map((a) => a.questionId)).not.toContain("wardrobe");
  });

  it(`never goes past ${MAX_ANSWERS} answers`, () => {
    const base = openers("friend", "20s");
    const steps = buildPlan("birthday", base, ["free_time", "gift_form", "style", "pets", "humor", "travel"], seeded(1));
    const answers = walk(steps, base, { free_time: "media", media_type: "games", gift_form: "experience", style: "comfy", wardrobe: "tops" });
    expect(answers.length).toBe(MAX_ANSWERS);
    expect(nextPlanned(steps, answers)).toBeNull();
  });

  it("alternates the AI's picks with fun and discovery questions", () => {
    const base = openers("friend", "30s_40s");
    const picks = ["free_time", "gift_form", "sentimental", "has_everything"];
    const steps = ids(buildPlan("birthday", base, picks, seeded(7)));
    expect(steps).toHaveLength(picks.length + DISCOVERY + FUN);
    // useful, fun, useful, discovery, useful, fun, useful
    expect([steps[0], steps[2], steps[4], steps[6]]).toEqual(picks);
    expect(getQuestion(steps[1])?.fun).toBe(true);
    expect(getQuestion(steps[5])?.fun).toBe(true);
    expect(getQuestion(steps[3])?.fun).toBeFalsy();
    expect(picks).not.toContain(steps[3]);
  });

  it("varies the extras between quizzes, so the whole bank gets asked over time", () => {
    const base = openers("friend", "30s_40s");
    const picks = ["free_time", "gift_form", "sentimental", "has_everything"];
    const discovery = new Set<string>();
    const fun = new Set<string>();
    for (let seed = 0; seed < 80; seed++) {
      const steps = ids(buildPlan("birthday", base, picks, seeded(seed)));
      discovery.add(steps[3]);
      fun.add(steps[1]).add(steps[5]);
    }
    expect(discovery.size).toBeGreaterThan(15);
    expect(discovery).toContain("pets");
    expect(discovery).toContain("reader");
    expect(fun.size).toBe(6); // every fun question comes up
  });

  it("never lets the AI plan fun questions", () => {
    const steps = ids(buildPlan("birthday", openers("friend", "30s_40s"), ["zombies", "pets", "humor", "travel"]));
    expect(steps).not.toContain("zombies");
  });

  it("plans from who and age, before the budget is known", () => {
    const whoAndAge = openers("friend", "20s").slice(0, 2);
    expect(validateAnswers("birthday", whoAndAge, 2)).toBeNull();
    expect(validateAnswers("birthday", whoAndAge)).not.toBeNull(); // results still need the budget
    const steps = buildPlan("birthday", whoAndAge, ["free_time", "pets", "humor"], seeded(3));
    const answers = walk(steps, openers("friend", "20s"));
    expect(validateAnswers("birthday", answers)).toBeNull();
  });

  it("produces answer lists the server accepts, for every occasion shape", () => {
    const cases: [Parameters<typeof buildPlan>[0], Answer[]][] = [
      ["birthday", openers("friend", "20s")],
      ["mothers_day", openers("relative", "50s_60s")],
      ["birthday", openers("relative", "70_plus")],
      ["valentines", openers("partner", "20s")],
      ["wedding", openers("coworker", "30s_40s")],
      ["anniversary", openers("partner", "30s_40s")],
    ];
    const picks: Record<string, string>[] = [
      {},
      { free_time: "media", media_type: "games" },
      { milestone: "new_baby" },
      { style: "bold", wardrobe: "shoes" },
    ];
    for (const [occasion, base] of cases) {
      for (let seed = 0; seed < 10; seed++) {
        const steps = buildPlan(occasion, base, [], seeded(seed));
        for (const pick of picks) {
          const answers = walk(steps, base, pick);
          expect(validateAnswers(occasion, answers), `${occasion} ${JSON.stringify(base)}`).toBeNull();
          expect(planSequence(steps, answers).length).toBeGreaterThanOrEqual(PLAN_MIN);
        }
      }
    }
  });
});
