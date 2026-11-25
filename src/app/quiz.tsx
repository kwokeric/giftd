"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import { copy } from "@/lib/copy";
import { OCCASION_OPTIONS, defaultOccasion } from "@/lib/occasion";
import type { GiftKind, SignedGift, TurnResponse } from "@/lib/schemas";
import { impliedAnswer } from "@/lib/implied";
import { OCCASIONS } from "@/lib/types";
import type { Answer, Occasion, PublicQuestion, Relationship } from "@/lib/types";
import { ArrowIcon, BackIcon, CheckIcon, GiftCard, Header, Pill, SCREEN, ShareIcon } from "./ui";

type View =
  | { kind: "landing" }
  | { kind: "question"; question: PublicQuestion; index: number; pickedId?: string; busy?: boolean }
  | { kind: "thinking" }
  | {
      kind: "result";
      resultId: string;
      gifts: SignedGift[];
      rejected: string[];
      rerolling: GiftKind | null;
      rerollError: GiftKind | null;
      /** Share link id for these exact gifts; cleared when a gift is swapped. */
      shareId: string | null;
    }
  | { kind: "error"; message: string; answers: Answer[] };

const MAX_QUESTIONS = 10;

function errorMessage(status: number): string {
  if (status === 429) return copy.errors.rateLimited;
  if (status === 502) return copy.errors.failed;
  return copy.errors.generic;
}

const noopSubscribe = () => () => {};

/** `/?occasion=wedding&help=1` is the "ask someone who knows them better" link. Client-only. */
function urlParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}
const urlOccasion = (): Occasion | null => {
  const o = urlParam("occasion");
  return (OCCASIONS as readonly string[]).includes(o ?? "") ? (o as Occasion) : null;
};

/** Native share sheet when there is one (phones), otherwise copy to the clipboard. */
async function shareLink(url: string, text: string): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  if (navigator.share) {
    try {
      await navigator.share({ text, url });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

// ---------------------------------------------------------------------------
// Progress is saved to sessionStorage so a refresh (or a quick trip to Amazon) doesn't
// lose the quiz. Only settled screens are saved: a question waiting for an answer, or results.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "giftd:quiz";

type Saved = {
  v: 1;
  occasion: Occasion;
  answers: Answer[];
  /** The question shown for each answer, so Back can return to it. */
  history: PublicQuestion[];
  view: Extract<View, { kind: "question" | "result" }>;
};

let savedCache: Saved | null | undefined;

function readSaved(): Saved | null {
  if (savedCache === undefined) {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Saved) : null;
      const ok =
        parsed?.v === 1 &&
        Array.isArray(parsed.answers) &&
        Array.isArray(parsed.history) &&
        (parsed.view?.kind === "question" || parsed.view?.kind === "result");
      savedCache = ok ? parsed : null;
    } catch {
      savedCache = null;
    }
  }
  return savedCache;
}

function writeSaved(saved: Saved | null) {
  try {
    if (saved) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode, blocked); the quiz still works without it.
  }
}

export default function Quiz({ openers }: { openers: PublicQuestion[] }) {
  // The page is prerendered, so saved progress can only be read on the client. The key swap
  // remounts the quiz with the saved state once it's available.
  const saved = useSyncExternalStore(noopSubscribe, readSaved, () => null);
  return <QuizFlow key={saved ? "restored" : "fresh"} openers={openers} saved={saved} />;
}

function QuizFlow({ openers, saved }: { openers: PublicQuestion[]; saved: Saved | null }) {
  // The calendar default is also client-only (null on the server).
  const calendarDefault = useSyncExternalStore(noopSubscribe, () => urlOccasion() ?? defaultOccasion(), () => null);
  const askedForHelp = useSyncExternalStore(noopSubscribe, () => urlParam("help") === "1", () => false);
  const [picked, setPicked] = useState<Occasion | null>(saved?.occasion ?? null);
  const occasion: Occasion = picked ?? calendarDefault ?? "birthday";
  const [shareStatus, setShareStatus] = useState<"idle" | "busy" | "error">("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>(saved?.answers ?? []);
  const [history, setHistory] = useState<PublicQuestion[]>(saved?.history ?? []);
  const [view, setView] = useState<View>(saved?.view ?? { kind: "landing" });

  // Saved progress is cleared only by start() and restart(), never here: on first load the fresh
  // landing screen renders before the saved copy is read, and must not wipe it.
  useEffect(() => {
    if (view.kind === "question" && !view.busy) writeSaved({ v: 1, occasion, answers, history, view });
    else if (view.kind === "result") {
      writeSaved({ v: 1, occasion, answers, history, view: { ...view, rerolling: null, rerollError: null } });
    }
  }, [view, answers, history, occasion]);

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
      setView({
        kind: "result",
        resultId: data.resultId,
        gifts: data.gifts,
        rejected: [],
        rerolling: null,
        rerollError: null,
        shareId: null,
      });
    }
  }

  // Openers the occasion already answers (e.g. Mother's Day → who and age) are filled in
  // silently and never shown.
  const isImplied = (a: Answer, position: number) =>
    position < openers.length && impliedAnswer(occasion, a.questionId) !== undefined;
  const impliedCount = openers.filter((q) => impliedAnswer(occasion, q.id)).length;
  /** Position among the questions the user actually sees (skipped openers before it don't count). */
  const shownIndex = (index: number) =>
    index - openers.slice(0, index - 1).filter((q) => impliedAnswer(occasion, q.id)).length;

  /** Appends answers for any upcoming openers the occasion already answers. */
  function fillImplied(list: Answer[], hist: PublicQuestion[]) {
    const a = [...list];
    const h = [...hist];
    while (a.length < openers.length) {
      const q = openers[a.length];
      const implied = impliedAnswer(occasion, q.id);
      if (!implied) break;
      a.push({ questionId: q.id, optionId: implied.optionId });
      h.push(q);
    }
    return { a, h };
  }

  function start() {
    writeSaved(null);
    const { a, h } = fillImplied([], []);
    setAnswers(a);
    setHistory(h);
    setView({ kind: "question", question: openers[a.length], index: a.length + 1 });
  }

  function answer(questionId: string, optionId: string) {
    if (view.kind !== "question" || view.busy) return;
    const { a: next, h } = fillImplied([...answers, { questionId, optionId }], [...history, view.question]);
    setAnswers(next);
    setHistory(h);
    if (next.length < openers.length) {
      setView({ kind: "question", question: openers[next.length], index: next.length + 1 });
    } else {
      // Keep the question on screen with the pick highlighted while the next turn loads.
      setView({ ...view, pickedId: optionId, busy: true });
      void fetchTurn(next);
    }
  }

  /** Return to the previous question with its old answer highlighted; tapping any answer moves on. */
  function back() {
    if (view.kind !== "question" || view.busy) return;
    // Step over answers the occasion filled in: the user never saw those questions.
    let a = answers;
    let h = history;
    while (a.length > 0 && isImplied(a[a.length - 1], a.length - 1)) {
      a = a.slice(0, -1);
      h = h.slice(0, -1);
    }
    if (a.length === 0) {
      writeSaved(null);
      setView({ kind: "landing" });
      return;
    }
    setAnswers(a.slice(0, -1));
    setHistory(h.slice(0, -1));
    setView({ kind: "question", question: h[h.length - 1], index: a.length, pickedId: a[a.length - 1].optionId });
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
      shareId: null,
    });
  }

  function flash(message: string) {
    setNotice(message);
    setTimeout(() => setNotice((n) => (n === message ? null : n)), 2500);
  }

  async function shareResult() {
    if (view.kind !== "result" || shareStatus === "busy") return;
    const current = view;
    let id = current.shareId;
    if (!id) {
      setShareStatus("busy");
      try {
        const res = await fetch("/api/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ occasion, answers, gifts: current.gifts }),
        });
        if (!res.ok) throw new Error(String(res.status));
        id = ((await res.json()) as { id: string }).id;
      } catch {
        setShareStatus("error");
        return;
      }
      setShareStatus("idle");
      const newId = id;
      setView((v) => (v.kind === "result" && v.resultId === current.resultId ? { ...v, shareId: newId } : v));
    }
    const outcome = await shareLink(`${window.location.origin}/r/${id}`, copy.shareText);
    if (outcome === "copied") flash(copy.shareCopied);
    if (outcome === "failed") setShareStatus("error");
  }

  async function askHelp() {
    const outcome = await shareLink(`${window.location.origin}/?occasion=${occasion}&help=1`, copy.askHelpText);
    if (outcome === "copied") flash(copy.askHelpCopied);
  }

  function restart() {
    writeSaved(null);
    setAnswers([]);
    setHistory([]);
    setView({ kind: "landing" });
  }

  return (
    <main className={SCREEN}>
      {view.kind === "landing" && (
        <section className="fade-in flex flex-1 flex-col">
          <Header />
          {askedForHelp ? (
            <p className="mt-16 text-base font-bold text-kicker">{copy.helpBanner}</p>
          ) : null}
          <h1
            className={`${askedForHelp ? "mt-3" : "mt-24"} text-[56px] leading-[0.98] font-extrabold tracking-[-0.045em]`}
          >
            {copy.tagline}
          </h1>
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

      {view.kind === "question" && (() => {
        const relationship = answers.find((a) => a.questionId === "relationship")?.optionId;
        const options = view.question.options.filter(
          (o) => !relationship || !o.hideFor?.includes(relationship as Relationship),
        );
        // Long answer lists get a tighter layout so they still fit on a phone screen.
        const compact = options.length > 5;
        return (
        <section key={view.question.id} className="fade-in flex flex-1 flex-col">
          <Header
            left={
              <button
                onClick={back}
                disabled={view.busy}
                aria-label={copy.back}
                className="glass -ml-1 flex size-10 items-center justify-center rounded-full transition-opacity disabled:opacity-50"
              >
                <BackIcon />
              </button>
            }
            right={<Pill>{copy.progress(shownIndex(view.index), MAX_QUESTIONS - impliedCount)}</Pill>}
          />
          <h1
            className={`${compact ? "mt-10 text-[32px]" : "mt-28 text-[38px]"} leading-[1.08] font-extrabold tracking-[-0.035em]`}
          >
            {view.question.text}
          </h1>
          <div className={`mt-auto flex flex-col pt-8 ${compact ? "gap-2" : "gap-3"}`}>
            {options.map((o) => {
              const on = view.pickedId === o.id;
              // While the next turn loads, the other answers leave one after another, top to bottom.
              const leaveOrder = options.filter((x) => x.id !== view.pickedId).findIndex((x) => x.id === o.id);
              return (
                <button
                  key={o.id}
                  onClick={() => answer(view.question.id, o.id)}
                  disabled={view.busy}
                  className={`flex items-center justify-between gap-3 rounded-[20px] px-[22px] text-left transition ${
                    compact ? "min-h-[52px] py-2 text-base" : "min-h-16 py-3 text-lg"
                  } ${
                    on ? "border border-transparent bg-solid font-semibold text-solid-fg" : "glass font-semibold"
                  } ${view.busy ? (on ? "answer-wait" : "answer-leave") : ""}`}
                  style={view.busy && !on ? ({ "--i": leaveOrder } as CSSProperties) : undefined}
                >
                  {o.label}
                  {/* Always takes its space, so picking an answer never re-wraps the text */}
                  <span className={on ? "" : "invisible"}>
                    <CheckIcon />
                  </span>
                </button>
              );
            })}
          </div>
          <Progress index={shownIndex(view.index)} total={MAX_QUESTIONS - impliedCount} />
          {/* No visible loading text: the leaving answers are the loading state. */}
          <p aria-live="polite" className="sr-only">
            {view.busy ? copy.thinking : ""}
          </p>
        </section>
        );
      })()}

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
                <GiftCard
                  key={g.kind}
                  gift={g}
                  busy={rerolling}
                  actions={
                    <button
                      onClick={() => void notIt(g.kind)}
                      disabled={view.rerolling !== null || shareStatus === "busy"}
                      className="inline-flex min-h-11 items-center rounded-full border border-outline px-4 text-[15px] font-semibold disabled:opacity-60"
                    >
                      {rerolling ? copy.findingAnother : copy.notIt}
                    </button>
                  }
                  footer={
                    view.rerollError === g.kind && (
                      <p role="alert" className="mt-2 text-sm font-semibold text-kicker">
                        {copy.rerollFailed}
                      </p>
                    )
                  }
                />
              );
            })}
          </div>
          <div className="mt-5 flex flex-col items-center gap-1">
            <button
              onClick={() => void shareResult()}
              disabled={shareStatus === "busy" || view.rerolling !== null}
              className="glass flex min-h-13 w-full items-center justify-center gap-2 rounded-[20px] text-base font-extrabold disabled:opacity-60"
            >
              <ShareIcon />
              {shareStatus === "busy" ? copy.sharing : copy.share}
            </button>
            <button onClick={() => void askHelp()} className="min-h-11 px-4 text-sm font-semibold text-muted underline-offset-4 hover:underline">
              {copy.askHelp}
            </button>
            <p aria-live="polite" className="h-5 text-sm font-semibold text-kicker">
              {shareStatus === "error" ? copy.shareFailed : notice}
            </p>
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

function Progress({ index, total }: { index: number; total: number }) {
  return (
    <div
      role="progressbar"
      aria-label="Quiz progress"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={index}
      className="mt-[22px] h-1 overflow-hidden rounded-full bg-track"
    >
      <div className="h-full rounded-full bg-bar transition-[width] duration-300" style={{ width: `${(index / total) * 100}%` }} />
    </div>
  );
}
