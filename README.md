# giftd

**Find their gift.**

**Try it: [giftd-ai.vercel.app](https://giftd-ai.vercel.app/)**

giftd is a mobile web app for when you're stuck on a gift. It plays like a short game of 20 Questions: answer up to 10 tap-only questions about them, and AI recommends three gifts, each with a reason and a shopping link.

## What it's like

The questions are meant to be fun to answer, with the joke in the answers:

> **How would they react to a sentimental gift?**
> Immediately tear up · "Aww, thanks so much!" · Ask for the receipt

> **Who do they call when the Wi-Fi breaks?**
> Nobody. They are the IT department · Customer support, eventually · You

## How it works

1. **Three quick openers**: who it's for, roughly how old they are, and the budget. These load instantly.
2. **Adaptive questions**: AI picks the next question from a hand-written bank of 52, choosing whichever answer would most change the recommendations. It can follow a thread ("Out and active" → "What's their idea of a good sweat?") instead of skimming topics.
3. **Three gift picks**: once it's confident (never before question 5, never after question 10), it recommends three gifts that fit the occasion and budget.

## Design decisions

- **AI picks the gifts; you refine them.** Recommendations are generated for each person, not pulled from a fixed catalog. Tap "Not it" on any pick and the AI swaps it for something new, remembering what you passed on so the next ideas get closer.
- **AI picks questions; it doesn't write them.** Every question and answer comes from a curated bank, so the quiz always sounds right and stays on brand. The AI's job is choosing what to ask next.
- **The rules live in code, not in the prompt.** The server decides which questions are allowed (no wine questions for a kid, no "how long have you been together?" for a coworker), enforces the 5–10 question range, and checks every AI response. If the AI fails, the quiz falls back to the next-best question instead of breaking.
- **Tap-only answers.** There's no free text, which keeps the quiz fast on a phone and keeps users' typing out of the AI prompt entirely.
- **Built to learn.** Every recommendation is tagged with a gift category, so after launch, real click data can show which kinds of gifts work for which kinds of people and feed back into the recommendations.
- **Tested with simulated shoppers.** A playtest script has AI "shoppers" take the quiz as 20 different people (a golf-obsessed dad, an exhausted new mom, a coworker you barely know) to measure question count, gift quality, cost and speed.

## Built with

Next.js · React · TypeScript · Tailwind CSS · Claude API (Anthropic) · Zod · Vitest · Vercel

---

<sub>To run it locally: `npm install`, add an `ANTHROPIC_API_KEY` to `.env.local`, then `npm run dev`.</sub>
