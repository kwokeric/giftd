// All UI microcopy in one place. Voice: a friend who knows them, not a brand mascot.
// Specific and relatable, PG, no memes or slang. See "giftd — Question Bank.md" → Voice.

export const copy = {
  tagline: "Find their gift",
  occasionPrompt: "What's the occasion?",
  start: "Find a gift",
  progress: (index: number, total: number) => `${index} of ${total}`,
  thinking: "Thinking…",
  resultTitle: "Here's what we'd get them",
  kinds: {
    safe: "Safe bet",
    wildcard: "Wildcard",
    budget: "Budget pick",
  },
  shop: "Shop",
  notIt: "Try another",
  findingAnother: "Finding another…",
  rerollFailed: "Couldn't find another one. Try again?",
  restart: "Start over",
  back: "Back",
  retry: "Try again",

  // Sharing
  share: "Share these picks",
  sharing: "Making a link…",
  shareCopied: "Link copied",
  shareFailed: "Couldn't make a link. Try again?",
  shareText: "Gift ideas from giftd",
  // Sharing the app itself, no results attached
  shareApp: "Share giftd",
  shareAppText: "Bad at gifting? This finds the gift in a few taps.",
  shareAppCopied: "Link copied. Spread the word",
  helpBanner: "Someone wants your help picking a gift.",

  // Shared result page (/r/[id])
  recipient: {
    partner: "a partner",
    relative: "a relative",
    friend: "a friend",
    coworker: "a coworker",
    other: "someone special",
  },
  recipientMom: "Mom",
  recipientDad: "Dad",
  sharedTitle: (recipient: string) => `Gift ideas for ${recipient}`,
  sharedLoading: "Unwrapping…",
  sharedCta: "Find a gift for someone else",
  notFoundTitle: "This gift list has expired",
  notFoundBody: "Shared picks last 90 days. That's longer than most gift receipts.",
  notFoundCta: "Find a gift",
  errors: {
    rateLimited: "That's a lot of gift shopping. Take a breather and try again in a bit.",
    failed: "Our gift brain froze for a second. Try again?",
    generic: "Something went sideways. Try again?",
  },
} as const;
