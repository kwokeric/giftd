# giftd

**Find their gift**

**Try it: [giftd-ai.vercel.app](https://giftd-ai.vercel.app/)**

giftd is a mobile web app for when you're stuck on a gift. It plays like a short game of 20 Questions: answer up to 12 tap-only questions about an adult in your life, and AI recommends three gifts, each with a photo, a price range and a shopping link.

## What it's like

The questions are meant to be fun to answer, with the joke in the answers:

> **How would they react to a sentimental gift?**
> Immediately tear up · "Aww, thanks so much!" · Ask for the receipt

> **Who do they call when the Wi-Fi breaks?**
> Nobody. They are the IT department · Customer support, eventually · You

## How it works

1. **Three quick openers**: who it's for, roughly how old they are, and the budget. These load instantly.
2. **A planned set of questions**: AI picks the questions that would most change the recommendations, from a hand-written bank of 60, in one go. A couple of just-for-fun personality questions ("How do they survive the zombie apocalypse?") and one random pick are mixed in, so every quiz is a little different. Follow-ups slot in by rule as you answer ("Halfway up a trail" → "What's their idea of a good sweat?"), so it can go deep on a topic, and the next question appears instantly.
3. **Three gift picks**: after at most 12 questions, it recommends three gifts that fit the occasion and budget.

## Design decisions

- **AI picks the gifts; you refine them.** Recommendations are generated for each person, not pulled from a fixed catalog. Tap "Not it" on any pick and the AI swaps it for something new, remembering what you passed on so the next ideas get closer.
- **AI picks questions; it doesn't write them.** Every question and answer comes from a curated bank, so the quiz always sounds right and stays on brand. The AI's job is choosing what to ask.
- **Two AI calls per quiz, not ten.** Asking the AI after every answer meant a wait after every tap. Instead it plans the questions once (from who and age, in the background while you pick a budget, so you never see it), the phone handles follow-ups by rule, and the AI only comes back to pick the gifts.
- **The rules live in code, not in the prompt.** The server decides which questions are allowed (no "how long have you been together?" for a coworker, no retirement-pace questions for a 20-something), enforces the 12-question limit, and checks every AI response. If the AI fails to plan, the quiz falls back to the highest-priority questions instead of breaking.
- **Tap-only answers.** There's no free text, which keeps the quiz fast on a phone and keeps users' typing out of the AI prompt entirely.
- **Built to learn.** Every recommendation is tagged with a gift category, so after launch, real click data can show which kinds of gifts work for which kinds of people and feed back into the recommendations.
- **Tested with simulated shoppers.** A playtest script has AI "shoppers" take the quiz as 20 different people (a golf-obsessed dad, an exhausted new mom, a coworker you barely know) to measure question count, gift quality, cost and speed.

## Built with

Next.js · React · TypeScript · Tailwind CSS · Claude API (Anthropic) · Zod · Vitest · Vercel

---

<sub>To run it locally: `npm install`, add an `ANTHROPIC_API_KEY` to `.env.local`, then `npm run dev`.</sub>
