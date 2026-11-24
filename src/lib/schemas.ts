import { z } from "zod";
import { OCCASIONS } from "./types";

export const GIFT_CATEGORIES = [
  "kitchen_cooking",
  "coffee_tea",
  "food_treats",
  "drinks_bar",
  "home_decor",
  "home_comfort",
  "garden_plants",
  "tech_gadgets",
  "gaming",
  "books_reading",
  "music_audio",
  "art_craft",
  "diy_tools",
  "outdoors_camping",
  "fitness_sports",
  "wellness_selfcare",
  "beauty_grooming",
  "fashion_accessories",
  "jewelry",
  "travel_gear",
  "pets",
  "kids_toys",
  "kids_learning",
  "games_puzzles",
  "stationery_desk",
  "keepsakes_personalized",
  "fandom_collectibles",
  "car_commute",
  "experiences",
  "subscriptions",
  "other",
] as const;
export const GiftCategory = z.enum(GIFT_CATEGORIES);
export type GiftCategory = z.infer<typeof GiftCategory>;

export const GIFT_KINDS = ["safe", "wildcard", "budget"] as const;
export const GiftKind = z.enum(GIFT_KINDS);
export type GiftKind = z.infer<typeof GiftKind>;

/**
 * Gift as Claude writes it. No length/size constraints here: structured outputs supports only
 * a subset of JSON Schema, so limits are checked in code after parsing (see turn.ts).
 */
export const ModelGift = z.object({
  name: z.string().describe("A gift idea, not a brand or specific product, e.g. 'Pour-over coffee kit'"),
  why: z.string().describe("One warm, slightly funny line tied to their answers"),
  priceRange: z.string().describe("e.g. '$25–40'"),
  kind: GiftKind,
  category: GiftCategory,
  searchQuery: z.string().describe("A short Amazon search query for this idea"),
});

/** Gift as it travels between client and server (length-capped). */
export const Gift = z.object({
  name: z.string().min(1).max(80),
  why: z.string().min(1).max(240),
  priceRange: z.string().min(1).max(30),
  kind: GiftKind,
  category: GiftCategory,
  searchQuery: z.string().min(1).max(120),
});
export type Gift = z.infer<typeof Gift>;

export const Occasion = z.enum(OCCASIONS);

export const AnswerSchema = z.object({
  questionId: z.string().min(1).max(40),
  optionId: z.string().min(1).max(40),
});

export const TurnRequest = z
  .object({
    occasion: Occasion,
    answers: z.array(AnswerSchema).max(10),
    mode: z.enum(["next", "reroll"]),
    rejected: z.array(z.string().max(80)).max(10).optional(),
    keep: z.array(Gift).max(2).optional(),
    rerollKind: GiftKind.optional(),
  })
  .refine((r) => r.mode === "next" || (r.rerollKind !== undefined && r.keep !== undefined), {
    message: "reroll needs keep and rerollKind",
  });
export type TurnRequest = z.infer<typeof TurnRequest>;

export type TurnResponse =
  | {
      type: "question";
      question: { id: string; text: string; options: { id: string; label: string }[] };
      index: number; // 4–10, for the progress bar
    }
  | { type: "result"; resultId: string; gifts: Gift[] };

// --- What Claude returns (per-turn schemas; see turn.ts) ---------------------

export function askSchema(eligibleIds: [string, ...string[]]) {
  return z.object({
    action: z.literal("ask"),
    questionId: z.enum(eligibleIds),
    confidence: z.number().describe("0–1: how confident you are that you could pick 3 gifts they'd be happy with now"),
  });
}

export const ResultSchema = z.object({
  action: z.literal("result"),
  gifts: z.array(ModelGift),
});

/** Ask or result. Wrapped in an object so the schema root is an object, not an anyOf. */
export function eitherSchema(eligibleIds: [string, ...string[]]) {
  return z.object({ turn: z.union([askSchema(eligibleIds), ResultSchema]) });
}
