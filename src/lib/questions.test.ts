import { describe, expect, it } from "vitest";
import { ALL_QUESTIONS, BANK, OPENERS, getQuestion } from "./questions";
import { AGE_BANDS, RELATIONSHIPS } from "./types";

describe("question bank", () => {
  it("has 3 openers and 54 bank questions", () => {
    expect(OPENERS.map((q) => q.id)).toEqual(["relationship", "age", "budget"]);
    expect(BANK).toHaveLength(54);
  });

  it("has unique question ids", () => {
    const ids = ALL_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique option ids per question", () => {
    for (const q of ALL_QUESTIONS) {
      const ids = q.options.map((o) => o.id);
      expect(new Set(ids).size, q.id).toBe(ids.length);
    }
  });

  it("gives bank questions 2–8 options and a 1–10 priority", () => {
    for (const q of BANK) {
      expect(q.options.length, q.id).toBeGreaterThanOrEqual(2);
      expect(q.options.length, q.id).toBeLessThanOrEqual(8);
      expect(q.priority, q.id).toBeGreaterThanOrEqual(1);
      expect(q.priority, q.id).toBeLessThanOrEqual(10);
    }
  });

  it("only references real questions and options", () => {
    for (const q of BANK) {
      const req = q.when?.requires;
      if (req) {
        const target = getQuestion(req.question);
        expect(target, `${q.id} requires ${req.question}`).toBeDefined();
        for (const opt of req.options) {
          expect(target!.options.map((o) => o.id), `${q.id} requires ${req.question}=${opt}`).toContain(opt);
        }
      }
      for (const ex of q.excludes ?? []) {
        expect(getQuestion(ex), `${q.id} excludes ${ex}`).toBeDefined();
      }
    }
  });

  it("keeps opener option ids in sync with the age and relationship types", () => {
    expect(getQuestion("age")!.options.map((o) => o.id)).toEqual([...AGE_BANDS]);
    expect(getQuestion("relationship")!.options.map((o) => o.id)).toEqual([...RELATIONSHIPS]);
  });

  it("gives every age option a fact (the age band Claude reads)", () => {
    for (const o of getQuestion("age")!.options) expect(o.fact, o.id).toBeTruthy();
  });

  it("contains no memes in copy", () => {
    const text = JSON.stringify(ALL_QUESTIONS);
    expect(text).not.toMatch(/6, 7|six seven|certified legend|main character/i);
  });
});
