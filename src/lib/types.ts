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

export const AGE_BANDS = ["under_12", "teen", "20s", "30s_40s", "50s_60s", "70_plus"] as const; // ordered
export type AgeBand = (typeof AGE_BANDS)[number];

export const RELATIONSHIPS = [
  "partner",
  "parent",
  "grandparent",
  "sibling",
  "friend",
  "coworker",
  "kid",
  "other",
] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export type QuestionCategory = "opener" | "interests" | "personality" | "lifestyle" | "gift_style" | "situational";

export type Option = {
  id: string;
  /** The only thing the user sees. */
  label: string;
  /** Server-side only, never shown: the plain meaning Claude reads when the label alone isn't a clear fact. */
  fact?: string;
};

export type Question = {
  /** Stable forever; used in analytics. Retire, don't rename. */
  id: string;
  text: string;
  /** 2–4 options (openers are exempt); the UI adds "Skip / idk". */
  options: Option[];
  category: QuestionCategory;
  /** 1–10; fallback order if Claude is unavailable. */
  priority: number;
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

export const SKIP = "skip";

export type Answer = {
  questionId: string;
  optionId: string; // an option id, or "skip"
};

/** What the client receives for a question: no `fact`s. */
export type PublicQuestion = {
  id: string;
  text: string;
  options: { id: string; label: string }[];
};
