import { ImageResponse } from "next/og";
import { copy } from "@/lib/copy";
import { OG_SIZE, OgFrame, ogFonts } from "./og";

export const alt = "giftd: Find their gift";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <OgFrame>
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
          <div style={{ fontSize: 150, fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 1 }}>{copy.tagline}</div>
        </div>
      </OgFrame>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
