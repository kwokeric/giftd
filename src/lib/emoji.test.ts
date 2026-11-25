import { describe, expect, it } from "vitest";
import { ANSWER_EMOJI } from "./emoji";
import { toPublic } from "./plan";
import { getQuestion } from "./questions";

describe("answer emojis", () => {
  it("covers every answer of a question, or none, and only real answers", () => {
    for (const [questionId, byOption] of Object.entries(ANSWER_EMOJI)) {
      const q = getQuestion(questionId);
      expect(q, questionId).toBeDefined();
      expect(Object.keys(byOption).sort(), questionId).toEqual(q!.options.map((o) => o.id).sort());
    }
  });

  it("never goes on gift-style questions", () => {
    for (const id of ["gift_form", "upgrade_or_new", "personalized", "couple_vibe", "wedding_angle"]) {
      expect(ANSWER_EMOJI[id]).toBeUndefined();
    }
  });

  it("reaches the client with the answers, along with who an answer is hidden for", () => {
    const care = toPublic(getQuestion("care_style")!);
    expect(care.options.find((o) => o.id === "hugs")).toMatchObject({ emoji: "🤗", hideFor: ["coworker"] });
    expect(toPublic(getQuestion("gift_form")!).options[0].emoji).toBeUndefined();
  });
});
