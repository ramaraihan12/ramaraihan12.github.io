import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/content/site";

export const alt = `${site.name}, ${site.role.toLowerCase()} in ${site.location}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
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
          background: "#0e1022",
          color: "#e7e9f3",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 680 }}>
          <div style={{ fontSize: 28, color: "#a0a5c0" }}>{`${site.role} · ${site.location}`}</div>
          <div style={{ fontSize: 112, lineHeight: 1, letterSpacing: "-0.03em", marginTop: 24 }}>
            {site.name}
          </div>
          <div style={{ fontSize: 34, lineHeight: 1.35, color: "#c9cde3", marginTop: 32 }}>
            Laravel and Next.js web apps. Now building AI apps: RAG, agents, chatbots and
            workflow automation.
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#f0b43c", marginTop: 40 }}>
            github.com/ramaraihan12
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img, not next/image */}
        <img
          src={photoSrc}
          alt=""
          width={330}
          height={440}
          style={{ objectFit: "cover", borderRadius: 24, border: "2px solid #272c4b" }}
        />
      </div>
    ),
    size,
  );
}
