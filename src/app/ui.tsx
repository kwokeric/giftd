// Presentational pieces shared by the quiz (client) and the shared result page (server).
import Link from "next/link";
import type { ReactNode } from "react";
import { copy } from "@/lib/copy";
import { RingLoader } from "./loaders";
import type { Gift } from "@/lib/schemas";

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
  return <span className="glass rounded-full px-3.5 py-2 text-sm font-semibold">{children}</span>;
}

/** A pick: kind, price, name, why, and a row of actions (Shop this is always first). */
export function GiftCard({ gift, busy, actions, footer }: { gift: Gift; busy?: boolean; actions?: ReactNode; footer?: ReactNode }) {
  return (
    <article aria-busy={busy} className="glass fade-in relative rounded-[22px] px-[18px] py-4">
      {/* While "Not it" finds a replacement, the card dims and the glow ring spins over it. */}
      {busy && (
        <div className="fade-in pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <RingLoader />
        </div>
      )}
      <div className={`transition-[opacity,filter] duration-300 ${busy ? "opacity-30 blur-[2px]" : ""}`}>
      <div className="flex justify-between">
        <span className="text-xs font-extrabold tracking-[0.08em] text-kicker uppercase">{copy.kinds[gift.kind]}</span>
        <span className="text-sm font-semibold text-muted">{gift.priceRange}</span>
      </div>
      <h2 className="mt-1.5 text-[19px] font-extrabold tracking-[-0.02em]">{gift.name}</h2>
      <p className="mt-1.5 mb-3 text-sm leading-[1.4] text-body">{gift.why}</p>
      <div className="flex gap-2">
        <a
          href={shopUrl(gift.searchQuery)}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="inline-flex min-h-11 items-center rounded-full bg-solid px-[18px] text-[15px] font-extrabold text-solid-fg"
        >
          {copy.shop}
        </a>
        {actions}
      </div>
      {footer}
      </div>
    </article>
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
