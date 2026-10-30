import type { Metadata } from "next";
import { Cloth } from "@/components/extras/cloth";
import { notFoundCopy } from "@/content/copy";

/*
  GitHub Pages serves out/404.html for every address it has no file for, so this is a static page
  that can't know which address that was. The cloth reads it in the browser. The page's own
  chunk is only this and the cloth: nothing from the home page's scenes loads here.
*/

export const metadata: Metadata = {
  title: `${notFoundCopy.title} · Rama Raihan`,
  // The home page's canonical and preview don't belong on a page that isn't one.
  alternates: { canonical: null },
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main id="main">
      <Cloth />
    </main>
  );
}
