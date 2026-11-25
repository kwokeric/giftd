import { describe, expect, it } from "vitest";
import { eligible, fallbackQuestion, validateAnswers } from "./eligibility";
import { buildTurnMessage } from "./prompt";
import type { Answer } from "./types";

const openers = (relationship: string, age: string, budget = "50_100"): Answer[] => [
  { questionId: "relationship", optionId: relationship },
  { questionId: "age", optionId: age },
  { questionId: "budget", optionId: budget },
];
const ids = (answers: Answer[], occasion: Parameters<typeof eligible>[0] = "birthday") =>
  eligible(occasion, answers).map((q) => q.id);

describe("eligibility personas", () => {
  it("a 7-year-old kid never gets adult questions, gets kid ones", () => {
    const e = ids(openers("relative", "under_12"));
    expect(e).not.toContain("food_drink");
    expect(e).not.toContain("young_kids");
    expect(e).not.toContain("home_vibe");
    expect(e).not.toContain("teen_vibe");
    expect(e).toContain("kid_interest");
    expect(e).toContain("kid_reading");
  });

  it("follow-ups only appear after the matching answer", () => {
    const base = openers("friend", "30s_40s");
    expect(ids(base)).not.toContain("active_type");
    expect(ids([...base, { questionId: "free_time", optionId: "active" }])).toContain("active_type");
    expect(ids([...base, { questionId: "free_time", optionId: "making" }])).not.toContain("active_type");
  });

  it("follow-up chains go two deep", () => {
    const a = [
      ...openers("relative", "20s"),
      { questionId: "free_time", optionId: "media" },
      { questionId: "media_type", optionId: "games" },
    ];
    expect(ids(a)).toContain("gaming_platform");
  });

  it("partner questions only for partners", () => {
    expect(ids(openers("partner", "30s_40s"))).toContain("couple_stage");
    expect(ids(openers("relative", "50s_60s"))).not.toContain("couple_stage");
  });

  it("coworker closeness only for coworkers", () => {
    expect(ids(openers("coworker", "30s_40s"))).toContain("coworker_closeness");
    expect(ids(openers("friend", "30s_40s"))).not.toContain("coworker_closeness");
  });

  it("70+ gets mobility, younger doesn't", () => {
    expect(ids(openers("relative", "70_plus"))).toContain("mobility");
    expect(ids(openers("relative", "50s_60s"))).not.toContain("mobility");
  });

  it("a teen gets teen questions, not kid or adult ones", () => {
    const e = ids(openers("relative", "teen"));
    expect(e).toContain("teen_vibe");
    expect(e).toContain("wellness");
    expect(e).not.toContain("kid_interest");
    expect(e).not.toContain("food_drink");
  });

  it("occasion questions match the occasion", () => {
    expect(ids(openers("friend", "20s"), "wedding")).toContain("wedding_angle");
    expect(ids(openers("friend", "20s"), "birthday")).not.toContain("wedding_angle");
    expect(ids(openers("friend", "20s"), "graduation")).toContain("graduation_next");
    expect(ids(openers("friend", "20s"), "thank_you")).toContain("thank_you_for");
  });

  it("excludes work both ways", () => {
    const kid = openers("relative", "under_12");
    expect(ids([...kid, { questionId: "kid_interest", optionId: "build" }])).not.toContain("free_time");
    expect(ids([...kid, { questionId: "free_time", optionId: "active" }])).not.toContain("kid_interest");
  });

  it("never repeats a question", () => {
    const a = [...openers("friend", "20s"), { questionId: "pets", optionId: "dog" }];
    expect(ids(a)).not.toContain("pets");
  });
});

describe("fallbackQuestion", () => {
  it("picks the highest priority, first in bank order on ties", () => {
    const q = fallbackQuestion(eligible("birthday", openers("friend", "30s_40s")));
    expect(q?.id).toBe("free_time");
  });
});

describe("validateAnswers", () => {
  it("accepts a valid sequence", () => {
    const a = [...openers("friend", "30s_40s"), { questionId: "free_time", optionId: "active" }, { questionId: "active_type", optionId: "gym" }];
    expect(validateAnswers("birthday", a)).toBeNull();
  });

  it("requires the openers first and in order", () => {
    expect(validateAnswers("birthday", openers("friend", "20s").slice(0, 2))).not.toBeNull();
    const swapped = [...openers("friend", "20s")];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    expect(validateAnswers("birthday", swapped)).not.toBeNull();
  });

  it("rejects unknown ids, bad options, repeats and ineligible questions", () => {
    const base = openers("friend", "20s");
    expect(validateAnswers("birthday", [...base, { questionId: "nope", optionId: "x" }])).toMatch(/unknown question/);
    expect(validateAnswers("birthday", [...base, { questionId: "pets", optionId: "lizard" }])).toMatch(/unknown option/);
    expect(validateAnswers("birthday", [...base, { questionId: "pets", optionId: "dog" }, { questionId: "pets", optionId: "cat" }])).toMatch(/twice/);
    expect(validateAnswers("birthday", [...base, { questionId: "active_type", optionId: "gym" }])).toMatch(/not eligible/);
    expect(validateAnswers("birthday", [...openers("relative", "under_12"), { questionId: "food_drink", optionId: "cook" }])).toMatch(/not eligible/);
  });

  it("never lets a partner or coworker be a young kid", () => {
    expect(validateAnswers("birthday", openers("partner", "under_12"))).toMatch(/isn't offered/);
    expect(validateAnswers("birthday", openers("coworker", "under_12"))).toMatch(/isn't offered/);
    expect(validateAnswers("birthday", openers("relative", "under_12"))).toBeNull();
    expect(validateAnswers("birthday", openers("partner", "teen"))).toBeNull();
  });

  it("fills in openers the occasion already answers, and rejects anything else", () => {
    expect(validateAnswers("mothers_day", openers("relative", "50s_60s"))).toBeNull();
    expect(validateAnswers("mothers_day", openers("partner", "50s_60s"))).toMatch(/set by the occasion/);
    expect(validateAnswers("fathers_day", openers("relative", "70_plus"))).toMatch(/set by the occasion/);
    expect(validateAnswers("graduation", openers("friend", "20s"))).toBeNull();
    expect(validateAnswers("graduation", openers("friend", "teen"))).toMatch(/set by the occasion/);
    expect(validateAnswers("wedding", openers("coworker", "30s_40s"))).toBeNull();
    expect(validateAnswers("birthday", openers("partner", "20s"))).toBeNull();
  });

  it("tells Claude which answers were assumed rather than picked", () => {
    const msg = buildTurnMessage({ occasion: "mothers_day", answers: openers("relative", "50s_60s"), eligibleIds: ["pets"], allowed: "ask" });
    expect(msg).toContain("Not asked, assumed from the occasion: their mom");
    expect(msg).not.toContain("Groans when they sit down");
    expect(msg).toContain("What's the budget? → $50–100");
  });

  it("rejects skips (there is no skip)", () => {
    expect(validateAnswers("birthday", openers("skip", "20s"))).toMatch(/unknown option/);
  });
});
