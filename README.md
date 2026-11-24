# giftd

A few questions about them. Three gifts they'll actually like.

Plan and question bank: [giftd — Implementation Plan.md](giftd%20—%20Implementation%20Plan.md) · [giftd — Question Bank.md](giftd%20—%20Question%20Bank.md)

## Setup

```bash
npm install
cp .env.example .env.local   # then add your ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

Without an API key the quiz still runs (it falls back to the highest-priority questions), but it can't recommend gifts.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm test` | Unit tests (question bank + eligibility filter) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run playtest` | 20 persona playtests against the real API (~$0.01 each). `-- --only 3` or `-- --pick 5` to run fewer. Logs to `playtest-results/` |

## Where things live

| Path | What |
| --- | --- |
| `src/lib/questions.ts` | The question bank (keep in sync with the bank doc) |
| `src/lib/eligibility.ts` | Which questions can be asked next; answer validation |
| `src/lib/prompt.ts` | System prompt (cached) and per-turn messages. Bump `PROMPT_VERSION` when it changes |
| `src/lib/turn.ts` | The turn engine: bounds, Claude calls, retries, fallback |
| `src/lib/schemas.ts` | Zod schemas, gift categories |
| `src/lib/copy.ts` | All UI microcopy |
| `src/app/api/turn/route.ts` | `POST /api/turn` |
| `src/app/quiz.tsx` | The quiz UI |
| `scripts/playtest.ts` | Persona playtest |
