import { ImageResponse } from "next/og";
import { copy } from "@/lib/copy";
import { OG_SIZE, OgFrame, ogFonts } from "../../og";
import { getShare, shareHeadline } from "./share-data";

export const alt = "Gift ideas from giftd";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const share = await getShare(id);
  const fonts = await ogFonts();

  if (!share) {
    return new ImageResponse(
      (
        <OgFrame>
          <div style={{ marginTop: "auto", fontSize: 120, fontWeight: 800, letterSpacing: "-0.045em" }}>
            {copy.tagline}
          </div>
        </OgFrame>
      ),
      { ...size, fonts },
    );
  }

  const { title, occasion } = shareHeadline(share);
  return new ImageResponse(
    (
      <OgFrame>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "0.08em", color: "#ffc4e1", textTransform: "uppercase" }}>
            {occasion}
          </div>
          <div style={{ fontSize: 60, fontWeight: 800, letterSpacing: "-0.035em", marginTop: 4 }}>{title}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: "auto", paddingTop: 28 }}>
          {share.gifts.map((g) => (
            <div
              key={g.kind}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
                padding: "14px 28px",
                borderRadius: 24,
                backgroundColor: "rgba(255,255,255,0.09)",
                border: "1px solid rgba(255,255,255,0.22)",
              }}
            >
              <div style={{ width: 200, fontSize: 22, fontWeight: 800, letterSpacing: "0.08em", color: "#ffc4e1", textTransform: "uppercase" }}>
                {copy.kinds[g.kind]}
              </div>
              <div style={{ flex: 1, fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em" }}>{g.name}</div>
              <div style={{ fontSize: 26, fontWeight: 600, color: "#d9d3e6" }}>{g.priceRange}</div>
            </div>
          ))}
        </div>
      </OgFrame>
    ),
    { ...size, fonts },
  );
}
