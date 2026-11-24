"use client";

import { useState, useSyncExternalStore } from "react";
import { copy } from "@/lib/copy";
import { OCCASION_OPTIONS, defaultOccasion } from "@/lib/occasion";
import type { Gift, TurnResponse } from "@/lib/schemas";
import type { Answer, Occasion, PublicQuestion } from "@/lib/types";

type View =
  | { kind: "landing" }
  | { kind: "question"; question: PublicQuestion; index: number }
  | { kind: "loading"; answers: Answer[] }
  | { kind: "result"; resultId: string; gifts: Gift[] }
  | { kind: "error"; message: string; answers: Answer[] };

const AMAZON_TAG = process.env.NEXT_PUBLIC_AMAZON_TAG;

function shopUrl(searchQuery: string): string {
  const tag = AMAZON_TAG ? `&tag=${encodeURIComponent(AMAZON_TAG)}` : "";
  return `https://www.amazon.com/s?k=${encodeURIComponent(searchQuery)}${tag}`;
}

const noopSubscribe = () => () => {};

export default function Quiz({ openers }: { openers: PublicQuestion[] }) {
  // The page is prerendered, so the calendar default is read on the client (null on the server).
  const calendarDefault = useSyncExternalStore(noopSubscribe, () => defaultOccasion(), () => null);
  const [picked, setPicked] = useState<Occasion | null>(null);
  const occasion: Occasion = picked ?? calendarDefault ?? "birthday";
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [view, setView] = useState<View>({ kind: "landing" });

  async function fetchTurn(nextAnswers: Answer[]) {
    setView({ kind: "loading", answers: nextAnswers });
    try {
      const res = await fetch("/api/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occasion, answers: nextAnswers, mode: "next" }),
      });
      if (!res.ok) {
        const message =
          res.status === 429 ? copy.errors.rateLimited : res.status === 502 ? copy.errors.failed : copy.errors.generic;
        setView({ kind: "error", message, answers: nextAnswers });
        return;
      }
      const data = (await res.json()) as TurnResponse;
      if (data.type === "question") {
        setView({ kind: "question", question: data.question, index: data.index });
      } else {
        setView({ kind: "result", resultId: data.resultId, gifts: data.gifts });
      }
    } catch {
      setView({ kind: "error", message: copy.errors.generic, answers: nextAnswers });
    }
  }

  function start() {
    setAnswers([]);
    setView({ kind: "question", question: openers[0], index: 1 });
  }

  function answer(questionId: string, optionId: string) {
    const next = [...answers, { questionId, optionId }];
    setAnswers(next);
    if (next.length < openers.length) {
      setView({ kind: "question", question: openers[next.length], index: next.length + 1 });
    } else {
      void fetchTurn(next);
    }
  }

  function restart() {
    setAnswers([]);
    setView({ kind: "landing" });
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">
      <header className="mb-8 flex items-center justify-between">
        <button onClick={restart} className="text-2xl font-bold tracking-tight">
          giftd<span className="text-accent">.</span>
        </button>
      </header>

      {view.kind === "landing" && (
        <section className="flex flex-1 flex-col">
          <h1 className="mb-8 text-3xl font-semibold leading-tight">{copy.tagline}</h1>
          <p className="mb-3 text-sm font-medium text-muted">{copy.occasionPrompt}</p>
          <div className="mb-10 flex flex-wrap gap-2">
            {OCCASION_OPTIONS.map((o) => (
              <button
                key={o.id}
                onClick={() => setPicked(o.id)}
                aria-pressed={occasion === o.id}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  occasion === o.id
                    ? "border-accent bg-accent text-accent-contrast"
                    : "border-border bg-card hover:border-accent"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button
            onClick={start}
            className="mt-auto rounded-2xl bg-accent py-4 text-lg font-semibold text-accent-contrast shadow-sm active:scale-[0.99]"
          >
            {copy.start}
          </button>
        </section>
      )}

      {view.kind === "question" && (
        <section key={view.question.id} className="flex flex-1 flex-col">
          <Progress index={view.index} />
          <h2 className="mb-6 text-2xl font-semibold leading-snug">{view.question.text}</h2>
          <div className="flex flex-col gap-3">
            {view.question.options.map((o) => (
              <button
                key={o.id}
                onClick={() => answer(view.question.id, o.id)}
                className="rounded-2xl border border-border bg-card px-5 py-4 text-left text-base shadow-sm transition-colors hover:border-accent active:bg-accent-soft"
              >
                {o.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {view.kind === "loading" && (
        <section className="flex flex-1 flex-col" aria-busy="true">
          <Progress index={Math.min(view.answers.length + 1, 10)} />
          <p className="mb-6 text-sm text-muted">
            {view.answers.length >= 5 ? copy.loadingResult : copy.loadingQuestion}
          </p>
          <div className="mb-6 h-8 w-3/4 animate-pulse rounded-lg bg-border" />
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-border/60" />
            ))}
          </div>
        </section>
      )}

      {view.kind === "result" && (
        <section className="flex flex-1 flex-col">
          <h2 className="mb-6 text-2xl font-semibold">{copy.resultTitle}</h2>
          <div className="flex flex-col gap-4">
            {view.gifts.map((g) => (
              <article key={g.kind} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">{copy.kinds[g.kind]}</p>
                <h3 className="text-lg font-semibold">{g.name}</h3>
                <p className="mt-1 text-sm text-muted">{g.priceRange}</p>
                <p className="mt-3 text-base">{g.why}</p>
                <a
                  href={shopUrl(g.searchQuery)}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="mt-4 inline-block rounded-xl bg-accent-soft px-4 py-2 text-sm font-semibold text-accent"
                >
                  {copy.shop} →
                </a>
              </article>
            ))}
          </div>
          <button onClick={restart} className="mt-8 self-center px-4 py-2 text-sm text-muted hover:underline">
            {copy.restart}
          </button>
        </section>
      )}

      {view.kind === "error" && (
        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="mb-6 text-lg">{view.message}</p>
          <button
            onClick={() => void fetchTurn(view.answers)}
            className="rounded-2xl bg-accent px-6 py-3 font-semibold text-accent-contrast"
          >
            {copy.retry}
          </button>
          <button onClick={restart} className="mt-4 px-4 py-2 text-sm text-muted hover:underline">
            {copy.restart}
          </button>
        </section>
      )}
    </main>
  );
}

function Progress({ index }: { index: number }) {
  return (
    <div className="mb-6">
      <p className="mb-2 text-xs font-medium text-muted">{copy.progress(index)}</p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(index / 10) * 100}%` }} />
      </div>
    </div>
  );
}
