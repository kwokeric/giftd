"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import { copy } from "@/lib/copy";
import { OCCASION_OPTIONS, defaultOccasion } from "@/lib/occasion";
import type { GiftKind, PlanStep, SignedGift, TurnResponse } from "@/lib/schemas";
import { impliedAnswer } from "@/lib/implied";
import { MAX_ANSWERS, nextPlanned, planSequence } from "@/lib/plan-walk";
import { OCCASIONS } from "@/lib/types";
import type { Answer, Occasion, PublicQuestion, Relationship } from "@/lib/types";
import { PhraseLoader } from "./loaders";
import { ArrowIcon, BackIcon, ChatIcon, CheckIcon, GiftCard, GiftIcon, GiftTiles, Header, Pill, SCREEN, ShareIcon } from "./ui";

type View =
  | { kind: "landing" }
  | {
      kind: "question";
      question: PublicQuestion;
      index: number;
      pickedId?: string;
      busy?: boolean;
      /** The next screen, shown once the unpicked answers have left. */
      then?: { next: View; afterMs: number };
    }
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

/** The buttons at the end of the results all look alike. */
const endButton =
  "glass flex min-h-13 w-full items-center justify-center gap-2 rounded-[20px] px-4 text-[15px] font-extrabold disabled:opacity-60";

type Saved = {
  v: 3;
  occasion: Occasion;
  answers: Answer[];
  /** The questions the AI planned from who and age (null until then). */
  plan: PlanStep[] | null;
  /** Which who/age answers the plan was made for (see planKey). */
  planKey?: string;
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
        parsed?.v === 3 &&
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
  // The question plan, keyed by the who/age answers it was made for. It's requested as soon as
  // those are in, so it loads while the user picks a budget. steps is null while it's on its way.
  const [planState, setPlanState] = useState<PlanState | null>(
    saved?.plan && saved.planKey ? { key: saved.planKey, steps: saved.plan } : null,
  );
  // Set when the budget is answered before the plan has arrived: show the first planned
  // question as soon as it lands (but not before the exit animation is done).
  const [waiting, setWaiting] = useState<{ key: string; answers: Answer[]; afterMs: number; exitDone?: boolean } | null>(
    null,
  );
  const [view, setView] = useState<View>(saved?.view ?? { kind: "landing" });
  const plan = planState && planState.key === planKey(occasion, answers) ? planState.steps : null;

  // Mark the exit animation as played...
  const waitMs = waiting && !waiting.exitDone ? waiting.afterMs : null;
  useEffect(() => {
    if (waitMs === null) return;
    const t = setTimeout(() => setWaiting((w) => (w ? { ...w, exitDone: true } : w)), waitMs);
    return () => clearTimeout(t);
  }, [waitMs]);
  // ...then move on once the plan is here too.
  useEffect(() => {
    if (!waiting?.exitDone || planState?.key !== waiting.key || (!planState.steps && !planState.failed)) return;
    const { steps, failed } = planState;
    const t = setTimeout(() => {
      setWaiting(null);
      const first = steps && nextPlanned(steps, waiting.answers);
      if (first) setView({ kind: "question", question: first, index: waiting.answers.length + 1 });
      // The server never sends an empty plan; if it somehow did, show the retry screen.
      else setView({ kind: "error", message: failed ? errorMessage(failed) : copy.errors.generic, answers: waiting.answers });
    });
    return () => clearTimeout(t);
  }, [waiting, planState]);
  // Show the next known question once the exit animation has played.
  const then = view.kind === "question" ? view.then : undefined;
  useEffect(() => {
    if (!then) return;
    const t = setTimeout(() => setView(then.next), then.afterMs);
    return () => clearTimeout(t);
  }, [then]);

  // Saved progress is cleared only by start() and restart(), never here: on first load the fresh
  // landing screen renders before the saved copy is read, and must not wipe it.
  useEffect(() => {
    if (view.kind === "question" && !view.busy) writeSaved({ v: 3, occasion, answers, plan, planKey: planState?.key, history, view });
    else if (view.kind === "result") {
      writeSaved({ v: 3, occasion, answers, plan, planKey: planState?.key, history, view: { ...view, rerolling: null, rerollError: null } });
    }
  }, [view, answers, history, plan, planState, occasion]);

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

  /**
   * The first of the two calls in a quiz: plan the questions from the occasion, who and age.
   * Fired as soon as those are in, so it loads while the user picks a budget. Does nothing if
   * the plan for these answers is already here or on its way.
   */
  function requestPlan(a: Answer[]) {
    const key = planKey(occasion, a);
    if (planState?.key === key && !planState.failed) return;
    setPlanState({ key, steps: null });
    void postTurn({ occasion, answers: a.slice(0, PLAN_OPENERS), mode: "plan" }).then((data) => {
      const next: PlanState =
        "error" in data || data.type !== "plan"
          ? { key, steps: null, failed: "error" in data ? data.error || -1 : 500 }
          : { key, steps: data.steps };
      // Ignore a plan for answers the user has since changed.
      setPlanState((p) => (p?.key === key ? next : p));
    });
  }

  /** Budget answered: show the first planned question, waiting for the plan if it's still coming. */
  function afterBudget(current: Extract<View, { kind: "question" }>, next: Answer[], pickedId: string, afterMs: number) {
    const key = planKey(occasion, next);
    const first = planState?.key === key && planState.steps ? nextPlanned(planState.steps, next) : null;
    if (first) {
      setView({ ...current, pickedId, busy: true, then: { next: { kind: "question", question: first, index: next.length + 1 }, afterMs } });
      return;
    }
    requestPlan(next);
    setView({ ...current, pickedId, busy: true });
    setWaiting({ key, answers: next, afterMs });
  }

  /** The second call: after the last planned question, pick the gifts. */
  async function fetchResult(nextAnswers: Answer[]) {
    const data = await postTurn({ occasion, answers: nextAnswers, mode: "result" });
    if ("error" in data) {
      setView({ kind: "error", message: errorMessage(data.error), answers: nextAnswers });
    } else if (data.type === "result") {
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
  /**
   * Questions the user will see in total: the shown openers plus the plan (and the follow-ups
   * their answers unlocked so far). Before there's a plan, the most it could be.
   */
  const totalShown =
    openers.length -
    impliedCount +
    (plan ? Math.min(planSequence(plan, answers).length, MAX_ANSWERS - openers.length) : MAX_ANSWERS - openers.length);
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
    // Mother's/Father's Day already know who and age: start planning right away.
    if (a.length >= PLAN_OPENERS) requestPlan(a);
    setView({ kind: "question", question: openers[a.length], index: a.length + 1 });
  }

  function answer(questionId: string, optionId: string) {
    if (view.kind !== "question" || view.busy) return;
    const { a: next, h } = fillImplied([...answers, { questionId, optionId }], [...history, view.question]);
    setAnswers(next);
    setHistory(h);
    if (next.length === PLAN_OPENERS) requestPlan(next);
    // Every answer plays the same exit: the unpicked answers cascade out around the pick.
    // Openers and planned questions are already known, so they show as soon as it finishes.
    const afterMs = leaveDuration(visibleOptions(view.question, answers).length - 1);
    if (next.length === openers.length) return afterBudget(view, next, optionId, afterMs);
    const upcoming = next.length < openers.length ? openers[next.length] : plan ? nextPlanned(plan, next) : null;
    if (upcoming) {
      setView({ ...view, pickedId: optionId, busy: true, then: { next: { kind: "question", question: upcoming, index: next.length + 1 }, afterMs } });
      return;
    }
    // Last planned question: pick the gifts. The answers leave as usual, then the status lines
    // run until the gifts arrive (if they arrive first, they replace this screen directly).
    setView({ ...view, pickedId: optionId, busy: true, then: { next: { kind: "thinking" }, afterMs } });
    void fetchResult(next);
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
    if (failedAnswers.length === openers.length) {
      // The plan failed: ask again and carry on once it's here.
      requestPlan(failedAnswers);
      setWaiting({ key: planKey(occasion, failedAnswers), answers: failedAnswers, afterMs: 0 });
    } else void fetchResult(failedAnswers);
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

  async function shareApp() {
    const outcome = await shareLink(`${window.location.origin}/`, copy.shareAppText);
    if (outcome === "copied") flash(copy.shareAppCopied);
  }

  function restart() {
    writeSaved(null);
    setAnswers([]);
    setHistory([]);
    setPlanState(null);
    setWaiting(null);
    setView({ kind: "landing" });
  }

  return (
    <main className={SCREEN}>
      {view.kind === "landing" && (
        <section className="screen-in flex flex-1 flex-col">
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
        const options = visibleOptions(view.question, answers);
        // Long answer lists get a tighter layout so they still fit on a phone screen.
        const compact = options.length > 5;
        // No screen fade here: the header stays put between questions; only the question and
        // its answers animate in.
        return (
        <section key={view.question.id} className="flex flex-1 flex-col">
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
            right={<Pill>{copy.progress(shownIndex(view.index), totalShown)}</Pill>}
          />
          <h1
            className={`${view.busy ? "question-leave" : "question-enter"} ${compact ? "mt-10 text-[32px]" : "mt-28 text-[38px]"} leading-[1.08] font-extrabold tracking-[-0.035em]`}
            style={view.busy ? ({ "--leave": `${view.then?.afterMs ?? leaveDuration(options.length - 1)}ms` } as CSSProperties) : undefined}
          >
            {view.question.text}
          </h1>
          <div className={`mt-auto flex flex-col pt-8 ${compact ? "gap-2" : "gap-3"}`}>
            {options.map((o, i) => {
              const on = view.pickedId === o.id;
              // After a pick, the other answers leave one after another, top to bottom.
              const leaveOrder = options.filter((x) => x.id !== view.pickedId).findIndex((x) => x.id === o.id);
              return (
                <button
                  key={o.id}
                  onClick={() => answer(view.question.id, o.id)}
                  disabled={view.busy}
                  className={`flex items-center justify-between gap-3 rounded-[20px] px-[22px] text-left text-base transition ${
                    compact ? "min-h-[52px] py-2" : "min-h-16 py-3"
                  } ${
                    on ? "border border-transparent bg-solid font-semibold text-solid-fg" : "glass font-semibold"
                  } ${view.busy ? (on ? "answer-wait" : "answer-leave") : "answer-enter"}`}
                  style={
                    view.busy
                      ? on
                        ? undefined
                        : ({ "--i": leaveOrder, "--step": `${leaveStep(options.length - 1)}ms` } as CSSProperties)
                      : ({ "--i": i } as CSSProperties)
                  }
                >
                  <span className="flex items-center gap-3">
                    {o.emoji && (
                      <span aria-hidden="true" className="w-7 shrink-0 text-center text-xl leading-none">
                        {o.emoji}
                      </span>
                    )}
                    {o.label}
                  </span>
                  {/* Always takes its space, so picking an answer never re-wraps the text */}
                  <span className={on ? "" : "invisible"}>
                    <CheckIcon />
                  </span>
                </button>
              );
            })}
          </div>
          <Progress index={shownIndex(view.index)} total={totalShown} />
          {/* No visible loading text: the leaving answers are the loading state. */}
          <p aria-live="polite" className="sr-only">
            {view.busy ? copy.thinking : ""}
          </p>
        </section>
        );
      })()}

      {view.kind === "thinking" && (
        <section className="screen-in flex flex-1 flex-col">
          <Header />
          <div className="m-auto">
            <PhraseLoader />
          </div>
          <p aria-live="polite" className="sr-only">
            {copy.thinking}
          </p>
        </section>
      )}

      {view.kind === "result" && (
        <section className="screen-in flex flex-1 flex-col">
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
          <GiftTiles>
            {view.gifts.map((g, i) => (
              <GiftCard
                key={g.kind}
                gift={g}
                big={i === 0}
                busy={view.rerolling === g.kind}
                onNotIt={() => void notIt(g.kind)}
                notItDisabled={view.rerolling !== null || shareStatus === "busy"}
                error={
                  view.rerollError === g.kind && (
                    <p role="alert" className="mb-2 text-xs font-semibold text-[#ffc4e1]">
                      {copy.rerollFailed}
                    </p>
                  )
                }
              />
            ))}
          </GiftTiles>
          {/* Three ways to pass it on, styled alike: the picks, the quiz for this person, the app itself. */}
          <div className="mt-5 flex flex-col gap-2.5">
            <button
              onClick={() => void shareResult()}
              disabled={shareStatus === "busy" || view.rerolling !== null}
              className={endButton}
            >
              <ShareIcon />
              {shareStatus === "busy" ? copy.sharing : copy.share}
            </button>
            <button onClick={() => void askHelp()} className={endButton}>
              <ChatIcon />
              {copy.askHelp}
            </button>
            <button onClick={() => void shareApp()} className={endButton}>
              <GiftIcon />
              {copy.shareApp}
            </button>
          </div>
          <p aria-live="polite" className="mt-2 h-5 text-center text-sm font-semibold text-kicker">
            {shareStatus === "error" ? copy.shareFailed : notice}
          </p>
        </section>
      )}

      {view.kind === "error" && (
        <section className="screen-in flex flex-1 flex-col">
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

type PlanState = { key: string; steps: PlanStep[] | null; failed?: number };

/** Openers the plan is made from: everything before the budget (who and age). */
const PLAN_OPENERS = 2;
/** Identifies the answers a plan was made for; a new who or age needs a new plan. */
function planKey(occasion: Occasion, answers: Answer[]): string {
  return JSON.stringify([occasion, answers.slice(0, PLAN_OPENERS).map((x) => x.optionId)]);
}

/** The question's answers minus any hidden for who it's for (no "bedtime" for a partner). */
function visibleOptions(question: PublicQuestion, answers: Answer[]) {
  const relationship = answers.find((a) => a.questionId === "relationship")?.optionId;
  return question.options.filter((o) => !relationship || !o.hideFor?.includes(relationship as Relationship));
}

// The answer exit: each unpicked answer leaves LEAVE_STEP ms after the one above it, and takes
// LEAVE_MS to go. Long lists stagger faster so the exit never drags past ~0.75s.
const LEAVE_MS = 420;
const LEAVE_STEP = 80;
const LEAVE_MAX_STAGGER = 320;
function leaveStep(leavers: number): number {
  return leavers > 1 ? Math.min(LEAVE_STEP, LEAVE_MAX_STAGGER / (leavers - 1)) : 0;
}
/** How long to wait before showing the next question, so the whole exit is seen. */
function leaveDuration(leavers: number): number {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 150;
  return LEAVE_MS + leaveStep(leavers) * Math.max(leavers - 1, 0);
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
