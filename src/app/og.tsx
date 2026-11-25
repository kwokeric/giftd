// Shared pieces for the generated Open Graph images (link previews). Server-only.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";

export const OG_SIZE = { width: 1200, height: 630 };

// Manrope (SIL Open Font License), static weights: the image renderer can't use variable fonts.
const fontsPromise = Promise.all([
  readFile(join(process.cwd(), "assets/fonts/manrope-600.woff")),
  readFile(join(process.cwd(), "assets/fonts/manrope-800.woff")),
]).then(([semibold, extrabold]) => [
  { name: "Manrope", data: semibold, weight: 600 as const, style: "normal" as const },
  { name: "Manrope", data: extrabold, weight: 800 as const, style: "normal" as const },
]);

export const ogFonts = () => fontsPromise;

/** The dark Glow look: deep purple with soft pink, violet and cyan glows. */
export function OgFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "64px 72px",
        fontFamily: "Manrope",
        color: "#ffffff",
        backgroundColor: "#120e24",
        backgroundImage: [
          "radial-gradient(circle at 88% 8%, rgba(255,79,163,0.55), rgba(255,79,163,0) 42%)",
          "radial-gradient(circle at 6% 72%, rgba(106,92,255,0.6), rgba(106,92,255,0) 45%)",
          "radial-gradient(circle at 92% 98%, rgba(63,208,255,0.42), rgba(63,208,255,0) 40%)",
        ].join(", "),
      }}
    >
      <div style={{ display: "flex", fontSize: 44, fontWeight: 800, letterSpacing: "-0.04em" }}>
        giftd<span style={{ color: "#ff8cc6" }}>.</span>
      </div>
      {children}
    </div>
  );
}
