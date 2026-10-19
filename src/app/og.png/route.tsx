import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/content/site";
import { ogImage } from "@/lib/og";

// A route handler instead of opengraph-image.tsx: the static export writes that one out
// without a file extension, and GitHub Pages would then serve it as a download, not a PNG.
export const dynamic = "force-static";

export async function GET() {
  const photo = await readFile(join(process.cwd(), "public/images/rama.jpg"));
  const photoSrc = `data:image/jpeg;base64,${photo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#0f1a47",
          color: "#efe9dc",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 680 }}>
          <div style={{ fontSize: 26, color: "#9aa3c7" }}>{`${site.role} · ${site.location}`}</div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 104, lineHeight: 1, letterSpacing: "-0.03em", marginTop: 28 }}>
            <span>Who is</span>
            <span style={{ color: "#f4b223" }}>Rama Raihan?</span>
          </div>
          <div style={{ fontSize: 32, lineHeight: 1.35, color: "#c9cde3", marginTop: 32 }}>
            Laravel and Next.js web apps. Now building AI apps: RAG, agents, chatbots and
            workflow automation.
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img, not next/image */}
        <img
          src={photoSrc}
          alt=""
          width={330}
          height={440}
          style={{ objectFit: "cover", borderRadius: 16, border: "6px solid #f4b223" }}
        />
      </div>
    ),
    { width: ogImage.width, height: ogImage.height },
  );
}
