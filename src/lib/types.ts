export const OCCASIONS = [
  "birthday",
  "holiday",
  "anniversary",
  "valentines",
  "mothers_day",
  "fathers_day",
  "graduation",
  "wedding",
  "housewarming",
  "thank_you",
  "just_because",
] as const;
export type Occasion = (typeof OCCASIONS)[number];

// giftd is for adults (20+), so there are no kid or teen bands.
export const AGE_BANDS = ["20s", "30s", "40s", "50s_60s", "70_plus"] as const; // ordered
export type AgeBand = (typeof AGE_BANDS)[number];

export const RELATIONSHIPS = ["partner", "relative", "friend", "coworker", "other"] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export type QuestionCategory = "opener" | "interests" | "personality" | "lifestyle" | "gift_style" | "situational";

export type Option = {
  id: string;
  /** The only thing the user sees. */
  label: string;
  /** Server-side only, never shown: the plain meaning Claude reads when the label alone isn't a clear fact. */
  fact?: string;
  /** Hide this answer when the recipient is one of these (e.g. no "Still has a bedtime" for a partner). */
  hideFor?: Relationship[];
};

export type Question = {
  /** Stable forever; used in analytics. Retire, don't rename. */
  id: string;
  text: string;
  /** 2–8 options (openers are exempt). There is no skip, so include a "none / not sure" answer where one is needed. */
  options: Option[];
  category: QuestionCategory;
  /** 1–10; fallback order if Claude is unavailable. */
  priority: number;
  /**
   * Asked for fun, to keep the quiz engaging. The server adds a couple to every plan (the AI
   * doesn't plan these), and their answers reach the AI as a light signal, not a deciding one.
   */
  fun?: boolean;
  when?: {
    relationship?: Relationship[];
    notRelationship?: Relationship[];
    minAge?: AgeBand;
    maxAge?: AgeBand;
    occasion?: Occasion[];
    requires?: { question: string; options: string[] };
  };
  /** Near-duplicates: once one is asked, the others are dropped (applied both ways). */
  excludes?: string[];
};

export type Answer = {
  questionId: string;
  optionId: string;
};

/** What the client receives for a question: no `fact`s. */
export type PublicQuestion = {
  id: string;
  text: string;
  options: { id: string; label: string; emoji?: string; hideFor?: Relationship[] }[];
};
