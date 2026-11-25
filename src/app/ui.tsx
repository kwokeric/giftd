// Presentational pieces shared by the quiz (client) and the shared result page (server).
import Link from "next/link";
import type { ReactNode } from "react";
import { copy } from "@/lib/copy";
import { RingLoader } from "./loaders";
import type { Gift, GiftCategory, GiftKind } from "@/lib/schemas";

const AMAZON_TAG = process.env.NEXT_PUBLIC_AMAZON_TAG;

export function shopUrl(searchQuery: string): string {
  const tag = AMAZON_TAG ? `&tag=${encodeURIComponent(AMAZON_TAG)}` : "";
  return `https://www.amazon.com/s?k=${encodeURIComponent(searchQuery)}${tag}`;
}

export function Header({ left, right, logoHref }: { left?: ReactNode; right?: ReactNode; logoHref?: string }) {
  const logo = (
    <span className="text-[26px] font-extrabold tracking-[-0.04em]">
      giftd<span className="text-bar">.</span>
    </span>
  );
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {left}
        {logoHref ? <Link href={logoHref}>{logo}</Link> : logo}
      </div>
      {right}
    </header>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return <span className="glass rounded-full px-3.5 py-2 min-w-[5.75rem] text-center text-sm font-semibold tabular-nums">{children}</span>;
}

/** Shown when a gift has no photo: an emoji for its category on the kind's color. */
const CATEGORY_EMOJI: Record<GiftCategory, string> = {
  kitchen_cooking: "🍳",
  coffee_tea: "☕",
  food_treats: "🍫",
  drinks_bar: "🍸",
  home_decor: "🖼️",
  home_comfort: "🛋️",
  garden_plants: "🪴",
  tech_gadgets: "📱",
  gaming: "🎮",
  books_reading: "📚",
  music_audio: "🎧",
  art_craft: "🎨",
  diy_tools: "🧰",
  outdoors_camping: "🏕️",
  fitness_sports: "🏋️",
  wellness_selfcare: "🧖",
  beauty_grooming: "💄",
  fashion_accessories: "👜",
  jewelry: "💍",
  travel_gear: "🧳",
  pets: "🐾",
  kids_toys: "🧸",
  kids_learning: "🔬",
  games_puzzles: "🧩",
  stationery_desk: "✏️",
  keepsakes_personalized: "💌",
  fandom_collectibles: "🦸",
  car_commute: "🚗",
  experiences: "🎟️",
  subscriptions: "📦",
  other: "🎁",
};
const KIND_TINT: Record<GiftKind, string> = {
  safe: "radial-gradient(circle at 30% 20%, #ffb3d6, #b8327a)",
  wildcard: "radial-gradient(circle at 30% 20%, #a99bff, #3a2c9e)",
  budget: "radial-gradient(circle at 30% 20%, #9ee6ff, #1f7fa8)",
};

/** The three picks as photo tiles: the safe bet big on top, the other two side by side. */
export function GiftTiles({ children }: { children: ReactNode[] }) {
  const [top, ...rest] = children;
  return (
    <div className="flex flex-col gap-3">
      {top}
      <div className="grid grid-cols-2 gap-3">{rest}</div>
    </div>
  );
}

/**
 * A pick as a photo tile: kind, price and name over a dark fade at the bottom, then Shop this
 * and (in the quiz) Try another. Small tiles shorten Shop this and make Try another an icon.
 */
export function GiftCard({
  gift,
  big,
  busy,
  onNotIt,
  notItDisabled,
  error,
}: {
  gift: Gift;
  big?: boolean;
  busy?: boolean;
  onNotIt?: () => void;
  notItDisabled?: boolean;
  error?: ReactNode;
}) {
  const photo = gift.photo;
  return (
    <article
      aria-busy={busy}
      className={`fade-in relative isolate overflow-hidden rounded-[22px] border border-[var(--glass-border)] text-white ${big ? "h-72" : "h-64"}`}
      style={{ background: photo?.color ?? KIND_TINT[gift.kind] }}
    >
      <div className={`absolute inset-0 -z-10 transition-[opacity,filter] duration-300 ${busy ? "opacity-40 blur-[3px]" : ""}`}>
        {photo ? (
          // Pexels already serves sized, compressed images, so there's nothing for next/image to add.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.src} alt={photo.alt} className="size-full object-cover" />
        ) : (
          <div
            aria-hidden="true"
            className={`flex size-full justify-center ${big ? "pt-9 text-[84px]" : "pt-8 text-[56px]"}`}
            style={{ background: KIND_TINT[gift.kind] }}
          >
            <span className="drop-shadow-[0_6px_10px_rgba(0,0,0,.25)]">{CATEGORY_EMOJI[gift.category]}</span>
          </div>
        )}
      </div>
      {photo && (
        <a
          href={photo.byUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-2 right-2.5 max-w-[75%] truncate rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-semibold text-white/85"
        >
          {photo.by} · Pexels
        </a>
      )}
      {busy && (
        <div className="fade-in pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <RingLoader />
        </div>
      )}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/55 to-transparent px-3.5 pt-12 pb-3.5 transition-opacity duration-300 ${busy ? "opacity-40" : ""}`}
      >
        <div className={`flex text-xs ${big ? "items-baseline justify-between" : "flex-col gap-0.5"}`}>
          <span className="font-extrabold tracking-[0.08em] text-[#ffc4e1] uppercase">{copy.kinds[gift.kind]}</span>
          <span className="font-semibold text-white/85">{gift.priceRange}</span>
        </div>
        <h2 className={`mt-1 leading-tight font-extrabold tracking-[-0.02em] ${big ? "mb-3 text-[21px]" : "mb-2.5 text-base"}`}>
          {gift.name}
        </h2>
        {error}
        <div className="flex gap-2">
          <a
            href={shopUrl(gift.searchQuery)}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className={`inline-flex items-center justify-center rounded-full bg-white font-extrabold text-[#120e24] ${big ? "min-h-11 px-[18px] text-[15px]" : "min-h-10 flex-1 px-3 text-sm"}`}
          >
            <span className="flex items-center gap-1.5">
              {copy.shop}
              <ExternalIcon />
            </span>
          </a>
          {onNotIt && (
            <button
              onClick={onNotIt}
              disabled={notItDisabled}
              aria-label={big ? undefined : copy.notIt}
              className={`inline-flex items-center justify-center rounded-full border border-white/40 font-semibold disabled:opacity-60 ${big ? "min-h-11 px-4 text-[15px]" : "size-10 shrink-0"}`}
            >
              {big ? (
                <span className="flex items-center gap-1.5">
                  <RetryIcon />
                  {busy ? copy.findingAnother : copy.notIt}
                </span>
              ) : (
                <RetryIcon />
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function ExternalIcon() {
  return (
    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v5h-5" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function ShareIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v13M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
    </svg>
  );
}

export function ChatIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M21 12a8 8 0 0 1-11.6 7.14L4 20l1.1-4.4A8 8 0 1 1 21 12z" />
    </svg>
  );
}

export function GiftIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9zM3 7h18v4H3zM12 7v14M12 7S10.5 3 8 3.5 7 7 12 7zM12 7s1.5-4 4-3.5S17 7 12 7z" />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

/**
 * The app column. On phones it fills the screen so the main button sits at thumb height.
 * On larger screens it's capped at a phone-like height and centered, so bottom buttons
 * stay close to the content instead of drifting to the bottom of a tall window.
 */
export const SCREEN =
  "relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-7 pb-8 md:my-auto md:min-h-[min(100dvh,780px)] md:py-10";
