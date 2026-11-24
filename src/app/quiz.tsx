"use client";

import { useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { copy } from "@/lib/copy";
import { OCCASION_OPTIONS, defaultOccasion } from "@/lib/occasion";
import type { Gift, GiftKind, TurnResponse } from "@/lib/schemas";
import type { Answer, Occasion, PublicQuestion } from "@/lib/types";

type View =
  | { kind: "landing" }
  | { kind: "question"; question: PublicQuestion; index: number; pickedId?: string; busy?: boolean }
  | { kind: "thinking" }
  | {
      kind: "result";
      resultId: string;
      gifts: Gift[];
      rejected: string[];
      rerolling: GiftKind | null;
      rerollError: GiftKind | null;
    }
  | { kind: "error"; message: string; answers: Answer[] };

const AMAZON_TAG = process.env.NEXT_PUBLIC_AMAZON_TAG;
const MAX_QUESTIONS = 10;

function shopUrl(searchQuery: string): string {
  const tag = AMAZON_TAG ? `&tag=${encodeURIComponent(AMAZON_TAG)}` : "";
  return `https://www.amazon.com/s?k=${encodeURIComponent(searchQuery)}${tag}`;
}

function errorMessage(status: number): string {
  if (status === 429) return copy.errors.rateLimited;
  if (status === 502) return copy.errors.failed;
  return copy.errors.generic;
}

const noopSubscribe = () => () => {};

export default function Quiz({ openers }: { openers: PublicQuestion[] }) {
  // The page is prerendered, so the calendar default is read on the client (null on the server).
  const calendarDefault = useSyncExternalStore(noopSubscribe, () => defaultOccasion(), () => null);
  const [picked, setPicked] = useState<Occasion | null>(null);
  const occasion: Occasion = picked ?? calendarDefault ?? "birthday";
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [view, setView] = useState<View>({ kind: "landing" });

  async function postTurn(body: object): Promise<TurnResponse | { error: number }> {
    try {
      const res = await fetch("/api/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return { error: res.status };
      return (await res.json()) as TurnResponse;
    } catch {
      return { error: 0 };
    }
  }

  async function fetchTurn(nextAnswers: Answer[]) {
    const data = await postTurn({ occasion, answers: nextAnswers, mode: "next" });
    if ("error" in data) {
      setView({ kind: "error", message: errorMessage(data.error), answers: nextAnswers });
    } else if (data.type === "question") {
      setView({ kind: "question", question: data.question, index: data.index });
    } else {
      setView({ kind: "result", resultId: data.resultId, gifts: data.gifts, rejected: [], rerolling: null, rerollError: null });
    }
  }

  function start() {
    setAnswers([]);
    setView({ kind: "question", question: openers[0], index: 1 });
  }

  function answer(questionId: string, optionId: string) {
    if (view.kind !== "question" || view.busy) return;
    const next = [...answers, { questionId, optionId }];
    setAnswers(next);
    if (next.length < openers.length) {
      setView({ kind: "question", question: openers[next.length], index: next.length + 1 });
    } else {
      // Keep the question on screen with the pick highlighted while the next turn loads.
      setView({ ...view, pickedId: optionId, busy: true });
      void fetchTurn(next);
    }
  }

  function retry(failedAnswers: Answer[]) {
    setView({ kind: "thinking" });
    void fetchTurn(failedAnswers);
  }

  async function notIt(kind: GiftKind) {
    if (view.kind !== "result" || view.rerolling) return;
    const current = view;
    const gift = current.gifts.find((g) => g.kind === kind)!;
    const rejected = [...current.rejected, gift.name].slice(-10);
    setView({ ...current, rerolling: kind, rerollError: null });

    const data = await postTurn({
      occasion,
      answers,
      mode: "reroll",
      rerollKind: kind,
      keep: current.gifts.filter((g) => g.kind !== kind),
      rejected,
    });

    if ("error" in data || data.type !== "result" || data.gifts.length !== 1) {
      setView({ ...current, rerolling: null, rerollError: kind });
      return;
    }
    setView({
      ...current,
      gifts: current.gifts.map((g) => (g.kind === kind ? data.gifts[0] : g)),
      rejected,
      rerolling: null,
      rerollError: null,
    });
  }

  function restart() {
    setAnswers([]);
    setView({ kind: "landing" });
  }

  return (
    <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-7 pb-8">
      {view.kind === "landing" && (
        <section className="fade-in flex flex-1 flex-col">
          <Header />
          <h1 className="mt-24 text-[56px] leading-[0.98] font-extrabold tracking-[-0.045em]">{copy.tagline}</h1>
          <p className="mt-11 text-sm font-semibold text-muted">{copy.occasionPrompt}</p>
          <div className="mt-3.5 flex flex-wrap gap-2">
            {OCCASION_OPTIONS.map((o) => {
              const on = occasion === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => setPicked(o.id)}
                  aria-pressed={on}
                  className={`min-h-11 rounded-full px-4 text-[15px] font-semibold transition-colors ${
                    on ? "border border-transparent bg-solid text-solid-fg" : "glass"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={start}
            className="mt-auto flex min-h-16 items-center justify-center gap-2.5 rounded-[20px] bg-solid text-lg font-extrabold text-solid-fg transition-transform active:scale-[0.99]"
          >
            {copy.start}
            <ArrowIcon />
          </button>
        </section>
      )}

      {view.kind === "question" && (
        <section key={view.question.id} className="fade-in flex flex-1 flex-col">
          <Header right={<Pill>{copy.progress(view.index)}</Pill>} />
          <h1 className="mt-28 text-[38px] leading-[1.08] font-extrabold tracking-[-0.035em]">{view.question.text}</h1>
          <div className="mt-auto flex flex-col gap-3 pt-10">
            {view.question.options.map((o) => {
              const on = view.pickedId === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => answer(view.question.id, o.id)}
                  disabled={view.busy}
                  className={`flex min-h-16 items-center justify-between gap-3 rounded-[20px] px-[22px] py-3 text-left text-lg transition ${
                    on ? "border border-transparent bg-solid font-bold text-solid-fg" : "glass font-semibold"
                  } ${view.busy && !on ? "opacity-50" : ""}`}
                >
                  {o.label}
                  {on && <CheckIcon />}
                </button>
              );
            })}
          </div>
          <Progress index={view.index} />
          <p aria-live="polite" className="mt-3 h-5 text-sm font-semibold text-muted">
            {view.busy ? (answers.length >= 5 ? copy.pickingGifts : copy.thinking) : ""}
          </p>
        </section>
      )}

      {view.kind === "thinking" && (
        <section className="fade-in flex flex-1 flex-col">
          <Header />
          <p aria-live="polite" className="m-auto animate-pulse text-lg font-semibold text-muted">
            {copy.thinking}
          </p>
        </section>
      )}

      {view.kind === "result" && (
        <section className="fade-in flex flex-1 flex-col">
          <Header
            right={
              <button onClick={restart} className="glass rounded-full px-3.5 py-2 text-sm font-semibold">
                {copy.restart}
              </button>
            }
          />
          <h1 className="mt-6 mb-[18px] text-[30px] leading-[1.06] font-extrabold tracking-[-0.035em]">
            {copy.resultTitle}
          </h1>
          <div className="flex flex-col gap-3">
            {view.gifts.map((g) => {
              const rerolling = view.rerolling === g.kind;
              return (
                <article
                  key={g.kind}
                  aria-busy={rerolling}
                  className={`glass fade-in rounded-[22px] px-[18px] py-4 transition-opacity ${rerolling ? "opacity-60" : ""}`}
                >
                  <div className="flex justify-between">
                    <span className="text-xs font-extrabold tracking-[0.08em] text-kicker uppercase">{copy.kinds[g.kind]}</span>
                    <span className="text-sm font-semibold text-muted">{g.priceRange}</span>
                  </div>
                  <h2 className="mt-1.5 text-[19px] font-extrabold tracking-[-0.02em]">{g.name}</h2>
                  <p className="mt-1.5 mb-3 text-sm leading-[1.4] text-body">{g.why}</p>
                  <div className="flex gap-2">
                    <a
                      href={shopUrl(g.searchQuery)}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="inline-flex min-h-11 items-center rounded-full bg-solid px-[18px] text-[15px] font-extrabold text-solid-fg"
                    >
                      {copy.shop}
                    </a>
                    <button
                      onClick={() => void notIt(g.kind)}
                      disabled={view.rerolling !== null}
                      className="inline-flex min-h-11 items-center rounded-full border border-outline px-4 text-[15px] font-semibold disabled:opacity-60"
                    >
                      {rerolling ? copy.findingAnother : copy.notIt}
                    </button>
                  </div>
                  {view.rerollError === g.kind && (
                    <p role="alert" className="mt-2 text-sm font-semibold text-kicker">
                      {copy.rerollFailed}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {view.kind === "error" && (
        <section className="fade-in flex flex-1 flex-col">
          <Header />
          <div className="m-auto flex flex-col items-center text-center">
            <p role="alert" className="mb-6 text-lg font-semibold">
              {view.message}
            </p>
            <button
              onClick={() => retry(view.answers)}
              className="min-h-12 rounded-[20px] bg-solid px-6 font-extrabold text-solid-fg"
            >
              {copy.retry}
            </button>
            <button onClick={restart} className="mt-3 min-h-11 px-4 text-sm font-semibold text-muted">
              {copy.restart}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function Header({ right }: { right?: ReactNode }) {
  return (
    <header className="flex items-center justify-between">
      <span className="text-[26px] font-extrabold tracking-[-0.04em]">giftd</span>
      {right}
    </header>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return <span className="glass rounded-full px-3.5 py-2 text-sm font-semibold">{children}</span>;
}

function Progress({ index }: { index: number }) {
  return (
    <div
      role="progressbar"
      aria-label="Quiz progress"
      aria-valuemin={0}
      aria-valuemax={MAX_QUESTIONS}
      aria-valuenow={index}
      className="mt-[22px] h-1 overflow-hidden rounded-full bg-track"
    >
      <div className="h-full rounded-full bg-bar transition-[width] duration-300" style={{ width: `${(index / MAX_QUESTIONS) * 100}%` }} />
    </div>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
