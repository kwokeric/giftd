import { describe, expect, it } from "vitest";
import { validateAnswers } from "./eligibility";
import { buildPlan, nextPlanned, planSequence } from "./plan";
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

describe("question plan", () => {
  it("keeps the AI's order and drops ineligible, repeated and follow-up picks", () => {
    const base = openers("friend", "30s_40s");
    const steps = buildPlan("birthday", base, ["pets", "kid_interest", "pets", "active_type", "free_time", "humor"]);
    expect(ids(steps)).toEqual(["pets", "free_time", "humor"]);
  });

  it("tops up from priority order when the AI gives too few (or nothing)", () => {
    const base = openers("friend", "30s_40s");
    expect(buildPlan("birthday", base, ["pets"]).length).toBe(3);
    expect(ids(buildPlan("birthday", base, []))).toContain("free_time"); // priority 10
  });

  it("never plans two questions that exclude each other", () => {
    const kid = openers("relative", "under_12");
    expect(ids(buildPlan("birthday", kid, ["kid_interest", "free_time", "kid_reading"]))).toEqual(["kid_interest", "kid_reading", expect.any(String)]);
    expect(ids(buildPlan("birthday", kid, ["kid_interest", "free_time", "kid_reading"]))).not.toContain("free_time");
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
    const steps = buildPlan("birthday", base, ["free_time", "pets", "humor"]);
    const gamer = walk(steps, base, { free_time: "media", media_type: "games" });
    expect(gamer.slice(3).map((a) => a.questionId)).toEqual(["free_time", "media_type", "gaming_platform", "pets", "humor"]);
    const cook = walk(steps, base, { free_time: "cooking" });
    expect(cook.slice(3).map((a) => a.questionId)).toEqual(["free_time", "cooking_type", "pets", "humor"]);
  });

  it("never goes past 10 answers", () => {
    const base = openers("friend", "20s");
    const steps = buildPlan("birthday", base, ["free_time", "gift_form", "pets", "humor", "sentimental", "travel"]);
    const answers = walk(steps, base, { free_time: "media", media_type: "games", gift_form: "experience" });
    expect(answers.length).toBe(10);
    expect(nextPlanned(steps, answers)).toBeNull();
  });

  it("plans from who and age, before the budget is known", () => {
    const whoAndAge = openers("friend", "20s").slice(0, 2);
    expect(validateAnswers("birthday", whoAndAge, 2)).toBeNull();
    expect(validateAnswers("birthday", whoAndAge)).not.toBeNull(); // results still need the budget
    const steps = buildPlan("birthday", whoAndAge, ["free_time", "pets", "humor"]);
    const answers = walk(steps, openers("friend", "20s"));
    expect(validateAnswers("birthday", answers)).toBeNull();
  });

  it("produces answer lists the server accepts, for every occasion shape", () => {
    const cases: [Parameters<typeof buildPlan>[0], Answer[]][] = [
      ["birthday", openers("friend", "20s")],
      ["mothers_day", openers("relative", "50s_60s")],
      ["birthday", openers("relative", "under_12")],
      ["birthday", openers("relative", "teen")],
      ["wedding", openers("coworker", "30s_40s")],
      ["anniversary", openers("partner", "30s_40s")],
    ];
    for (const [occasion, base] of cases) {
      const steps = buildPlan(occasion, base, []);
      const picks: Record<string, string>[] = [{}, { free_time: "media", media_type: "games" }, { milestone: "new_baby" }];
      for (const pick of picks) {
        const answers = walk(steps, base, pick);
        expect(validateAnswers(occasion, answers), `${occasion} ${JSON.stringify(base)}`).toBeNull();
        expect(planSequence(steps, answers).length).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
