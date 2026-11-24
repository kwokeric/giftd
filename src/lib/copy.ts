// All UI microcopy in one place. Voice: a friend who knows them, not a brand mascot.
// Specific and relatable, PG, no memes or slang. See "giftd — Question Bank.md" → Voice.

export const copy = {
  tagline: "A few questions about them. Three gifts they'll actually like.",
  occasionPrompt: "What's the occasion?",
  start: "Find a gift",
  progress: (index: number) => `Question ${index} of up to 10`,
  loadingQuestion: "Thinking about what to ask next…",
  loadingResult: "Picking gifts they won't regift…",
  resultTitle: "Here's what we'd get them",
  kinds: {
    safe: "Safe bet",
    wildcard: "Wildcard",
    budget: "Budget pick",
  },
  shop: "Shop this",
  restart: "Start over",
  retry: "Try again",
  errors: {
    rateLimited: "That's a lot of gift shopping. Take a breather and try again in a bit.",
    failed: "Our gift brain froze for a second. Try again?",
    generic: "Something went sideways. Try again?",
  },
} as const;
