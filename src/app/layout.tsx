import type { Metadata, Viewport } from "next";
import { Anybody, Martian_Mono, Schibsted_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
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
  instead of flashing the plain one first. If the scripts haven't started after a few seconds
  (blocked, offline, a slow connection), that class comes off so nothing stays hidden, and
  data-engine="late" keeps it off for the rest of this page view: when the scripts do turn up,
  the scenes build their plain versions too, rather than rearranging a page someone's already
  reading. See scrollyOn() in src/lib/scroll.ts.
*/
const scrollyScript = `(() => {
  const root = document.documentElement;
  root.classList.add("js");
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) root.classList.add("scrolly");
  setTimeout(() => {
    if (root.dataset.engine) return;
    root.classList.remove("scrolly");
    root.dataset.engine = "late";
  }, 6000);
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
          Skip to content
        </a>
        {/* The nila and kunyit duotone, once for the page (.duotone and <Duotone> use it). */}
        <DuotoneFilter />
        {children}
        <Extras />
      </body>
    </html>
  );
}
