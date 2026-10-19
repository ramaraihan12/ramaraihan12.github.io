import type { Metadata } from "next";
import { Archivo, Geist_Mono, Instrument_Sans } from "next/font/google";
import type { ReactNode } from "react";
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
  title: "Rama Raihan · Full-stack developer",
  description:
    "Full-stack developer in Salatiga, Indonesia. Laravel and Next.js web apps, and now AI apps: RAG, agents, chatbots and workflow automation.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${instrumentSans.variable} ${geistMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
