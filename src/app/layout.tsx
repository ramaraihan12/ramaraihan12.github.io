import type { Metadata, Viewport } from "next";
import { Anybody, Martian_Mono, Schibsted_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { layoutCopy } from "@/content/copy";
import { site } from "@/content/site";
import { ogImage } from "@/lib/og";
import "./globals.css";
import { DuotoneFilter } from "@/components/art/duotone";
import { Extras } from "@/components/extras/extras";

const anybody = Anybody({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-anybody",
});

const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted",
});

const martian = Martian_Mono({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-martian",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: `${site.name} · ${site.role}`,
  description: site.description,
  authors: [{ name: site.name, url: site.github }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: site.name,
    title: `${site.name} · ${site.role}`,
    description: site.description,
    locale: "en_US",
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} · ${site.role}`,
    description: site.description,
    images: [ogImage],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f1a47",
};

/*
  Runs before first paint. "js" lets the canvas map show at all, since it's an empty box without
  scripts. With motion allowed, "scrolly" switches the scenes to their pinned layout right away
  instead of flashing the plain one first.

  If the scripts never make it (blocked by an extension or a content policy, a chunk that fails
  to load), both classes come off so nothing stays hidden. A slow phone isn't a failure, though:
  its scripts can take seconds to download and seconds more to build the scenes, and the engine
  only reports in (data-engine="on", from startEngine()) at the very end of that. So this gives up
  on real failures only:
  - One of the page's scripts fails to load. This waits for the stylesheets above it, so it also
    looks for scripts that failed before it ran: Chrome lists those in resource timing with no
    status, and then the page is plain from its first paint.
  - The page finished loading 4 seconds ago and the scripts still haven't shown a sign of life.
    The load event waits for every script the page starts with, and src/lib/scroll.ts sets
    data-scripts as soon as the browser runs it, long before the engine starts.
  - 20 seconds have passed and the engine still isn't up, whatever the reason.
  Giving up sets data-engine="late", which keeps the page plain for the rest of this view: when
  the scripts do turn up, the scenes build their plain versions too, rather than rearranging a
  page someone's already reading. See scrollyOn() in src/lib/scroll.ts.
*/
const scrollyScript = `(() => {
  const root = document.documentElement;
  root.classList.add("js");
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) root.classList.add("scrolly");
  const plain = () => {
    if (root.dataset.engine) return;
    root.classList.remove("scrolly", "js");
    root.dataset.engine = "late";
  };
  const ours = (url) => url.includes("/_next/");
  addEventListener("error", (e) => {
    if (e.target instanceof HTMLScriptElement && ours(e.target.src)) plain();
  }, true);
  for (const e of performance.getEntriesByType("resource")) {
    if (e.initiatorType === "script" && e.responseStatus === 0 && ours(e.name)) plain();
  }
  addEventListener("load", () => setTimeout(() => {
    if (!root.dataset.scripts) plain();
  }, 4000));
  setTimeout(plain, 20000);
})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${anybody.variable} ${schibsted.variable} ${martian.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: scrollyScript }} />
      </head>
      <body>
        <a href="#main" className="skip-link">
          {layoutCopy.skipLink}
        </a>
        {/* The nila and kunyit duotone, once for the page (.duotone and <Duotone> use it). */}
        <DuotoneFilter />
        {children}
        <Extras />
      </body>
    </html>
  );
}
