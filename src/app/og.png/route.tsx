import { ImageResponse } from "next/og";
import { ogCopy } from "@/content/copy";
import { loadFont, ogArtUri, ogImage } from "@/lib/og";

// A route handler instead of opengraph-image.tsx: the static export writes that one out
// without a file extension, and GitHub Pages would then serve it as a download, not a PNG.
export const dynamic = "force-static";

const title = ogCopy.title.join(" ");

export async function GET() {
  // The page's own faces, at the widths it uses: Anybody stretched wide for the question,
  // Martian Mono narrowed for the kicker, Schibsted Grotesk for the tagline.
  const [display, mono, sans] = await Promise.all([
    loadFont("Anybody", "wdth,wght@125,800", title),
    loadFont("Martian Mono", "wdth,wght@87.5,400", ogCopy.kicker),
    loadFont("Schibsted Grotesk", "wght@500", ogCopy.tagline),
  ]);
  const fonts = [
    display && { name: "Anybody", data: display, weight: 800 as const, style: "normal" as const },
    mono && { name: "Martian Mono", data: mono, weight: 400 as const, style: "normal" as const },
    sans && { name: "Schibsted Grotesk", data: sans, weight: 500 as const, style: "normal" as const },
  ].filter((f) => !!f);

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "64px 72px",
          background: "#0f1a47",
          color: "#efe9dc",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img, not next/image */}
        <img src={ogArtUri()} alt="" width={ogImage.width} height={ogImage.height} style={{ position: "absolute", top: 0, left: 0 }} />
        <div style={{ display: "flex", fontFamily: "Martian Mono", fontSize: 22, color: "#9aa3c7" }}>{ogCopy.kicker}</div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 26,
            fontFamily: "Anybody",
            fontWeight: 800,
            fontSize: 92,
            lineHeight: 0.98,
            letterSpacing: "-0.025em",
          }}
        >
          <span>{ogCopy.title[0]}</span>
          <span style={{ color: "#f4b223" }}>{ogCopy.title[1]}</span>
        </div>
        <div
          style={{
            display: "flex",
            maxWidth: 640,
            marginTop: 30,
            fontFamily: "Schibsted Grotesk",
            fontWeight: 500,
            fontSize: 29,
            lineHeight: 1.35,
            color: "#c9cde3",
          }}
        >
          {ogCopy.tagline}
        </div>
      </div>
    ),
    { width: ogImage.width, height: ogImage.height, fonts: fonts.length ? fonts : undefined },
  );
}
