// All UI microcopy in one place. Voice: a friend who knows them, not a brand mascot.
// Specific and relatable, PG, no memes or slang. See "giftd — Question Bank.md" → Voice.

export const copy = {
  tagline: "Find their gift.",
  occasionPrompt: "What's the occasion?",
  start: "Find a gift",
  progress: (index: number) => `${index} of 10`,
  thinking: "Thinking…",
  pickingGifts: "Picking gifts they won't regift…",
  resultTitle: "Here's what we'd get them",
  kinds: {
    safe: "Safe bet",
    wildcard: "Wildcard",
    budget: "Budget pick",
  },
  shop: "Shop this",
  notIt: "Not it",
  findingAnother: "Finding another…",
  rerollFailed: "Couldn't find another one. Try again?",
  restart: "Start over",
  retry: "Try again",
  errors: {
    rateLimited: "That's a lot of gift shopping. Take a breather and try again in a bit.",
    failed: "Our gift brain froze for a second. Try again?",
    generic: "Something went sideways. Try again?",
  },
} as const;
