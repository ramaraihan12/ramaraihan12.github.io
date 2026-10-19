import type { Metadata, Viewport } from "next";
import { Archivo, Geist_Mono, Instrument_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { site } from "@/content/site";
import { ogImage } from "@/lib/og";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1022" },
  ],
};

// Runs before first paint so the page never flashes the wrong theme.
const themeScript = `(() => {
  const root = document.documentElement;
  let theme = null;
  try { theme = localStorage.getItem("theme"); } catch {}
  const dark = theme ? theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.classList.toggle("dark", dark);
})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${instrumentSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:text-paper"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
