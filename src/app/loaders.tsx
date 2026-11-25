"use client";

import { useEffect, useState } from "react";

// The quiz's two loaders: status lines while the gifts are picked (~3–5s), and a glow ring
// over a card while "Try another" finds a replacement.

const PHRASES = [
  "Going over your answers",
  "Ruling out another candle",
  "Checking the budget",
  "Finding a wildcard",
  "Wrapping it up",
];
const PHRASE_MS = 1400;

/** Says what it's doing, one shimmering phrase at a time. Stays on the last one if it runs long. */
export function PhraseLoader() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, PHRASES.length - 1)), PHRASE_MS);
    return () => clearInterval(t);
  }, []);
  return (
    <div aria-hidden="true" className="flex flex-col items-center gap-3 text-center">
      <p key={i} className="loader-phrase loader-shimmer text-xl font-bold tracking-[-0.02em]">
        {PHRASES[i]}…
      </p>
      <div className="flex gap-1.5">
        {PHRASES.map((_, n) => (
          <span key={n} className={`h-1 rounded-full transition-all duration-500 ${n <= i ? "w-5 bg-bar" : "w-1.5 bg-track"}`} />
        ))}
      </div>
    </div>
  );
}

/** A spinning ring in the orb colors. */
export function RingLoader() {
  return (
    <div aria-hidden="true" className="relative size-14">
      <div className="loader-ring-glow absolute inset-0 rounded-full" />
      <div className="loader-ring absolute inset-0 rounded-full" />
    </div>
  );
}
