import { describe, expect, it } from "vitest";
import { eligible, fallbackQuestion, validateAnswers } from "./eligibility";
import { buildPlanMessage } from "./prompt";
import type { Answer } from "./types";

const openers = (relationship: string, age: string, budget = "50_100"): Answer[] => [
  { questionId: "relationship", optionId: relationship },
  { questionId: "age", optionId: age },
  { questionId: "budget", optionId: budget },
];
const ids = (answers: Answer[], occasion: Parameters<typeof eligible>[0] = "birthday") =>
  eligible(occasion, answers).map((q) => q.id);

describe("eligibility personas", () => {
  it("every adult gets the adult questions", () => {
    const e = ids(openers("relative", "20s"));
    expect(e).toContain("food_drink");
    expect(e).toContain("young_kids");
    expect(e).toContain("style");
  });

  it("follow-ups only appear after the matching answer", () => {
    const base = openers("friend", "30s");
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
    expect(ids(openers("partner", "30s"))).toContain("couple_stage");
    expect(ids(openers("relative", "50s_60s"))).not.toContain("couple_stage");
  });

  it("coworker closeness only for coworkers", () => {
    expect(ids(openers("coworker", "30s"))).toContain("coworker_closeness");
    expect(ids(openers("friend", "30s"))).not.toContain("coworker_closeness");
  });

  it("70+ gets mobility, younger doesn't", () => {
    expect(ids(openers("relative", "70_plus"))).toContain("mobility");
    expect(ids(openers("relative", "50s_60s"))).not.toContain("mobility");
  });


  it("occasion questions match the occasion", () => {
    expect(ids(openers("friend", "20s"), "wedding")).toContain("wedding_angle");
    expect(ids(openers("friend", "20s"), "birthday")).not.toContain("wedding_angle");
    expect(ids(openers("friend", "20s"), "graduation")).toContain("graduation_next");
    expect(ids(openers("friend", "20s"), "thank_you")).toContain("thank_you_for");
  });


  it("never repeats a question", () => {
    const a = [...openers("friend", "20s"), { questionId: "pets", optionId: "dog" }];
    expect(ids(a)).not.toContain("pets");
  });
});

describe("fallbackQuestion", () => {
  it("picks the highest priority, first in bank order on ties", () => {
    const q = fallbackQuestion(eligible("birthday", openers("friend", "30s")));
    expect(q?.id).toBe("free_time");
  });
});

describe("validateAnswers", () => {
  it("accepts a valid sequence", () => {
    const a = [...openers("friend", "30s"), { questionId: "free_time", optionId: "active" }, { questionId: "active_type", optionId: "gym" }];
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
    expect(validateAnswers("birthday", [...openers("relative", "20s"), { questionId: "mobility", optionId: "fine" }])).toMatch(/not eligible|unknown option/);
  });

  it("is for adults only: no kid or teen ages", () => {
    expect(validateAnswers("birthday", openers("relative", "under_12"))).toMatch(/unknown option/);
    expect(validateAnswers("birthday", openers("friend", "teen"))).toMatch(/unknown option/);
  });

  it("hides answers that don't fit the relationship", () => {
    const base = openers("coworker", "30s");
    expect(validateAnswers("birthday", [...base, { questionId: "care_style", optionId: "hugs" }])).toMatch(/isn't offered/);
    expect(validateAnswers("birthday", [...openers("friend", "30s"), { questionId: "care_style", optionId: "hugs" }])).toBeNull();
  });

  it("fills in openers the occasion already answers, and rejects anything else", () => {
    expect(validateAnswers("mothers_day", openers("relative", "50s_60s"))).toBeNull();
    expect(validateAnswers("mothers_day", openers("partner", "50s_60s"))).toMatch(/set by the occasion/);
    expect(validateAnswers("fathers_day", openers("relative", "70_plus"))).toMatch(/set by the occasion/);
    expect(validateAnswers("graduation", openers("friend", "20s"))).toBeNull();
    expect(validateAnswers("graduation", openers("friend", "30s"))).toMatch(/set by the occasion/);
    expect(validateAnswers("wedding", openers("coworker", "30s"))).toBeNull();
    expect(validateAnswers("birthday", openers("partner", "20s"))).toBeNull();
  });

  it("tells Claude which answers were assumed rather than picked", () => {
    const msg = buildPlanMessage({ occasion: "mothers_day", answers: openers("relative", "50s_60s"), eligibleIds: ["pets"] });
    expect(msg).toContain("Not asked, assumed from the occasion: their mom");
    expect(msg).not.toContain("Groans when they sit down");
    expect(msg).toContain("What's the budget? → $50–100");
  });

  it("rejects skips (there is no skip)", () => {
    expect(validateAnswers("birthday", openers("skip", "20s"))).toMatch(/unknown option/);
  });
});
