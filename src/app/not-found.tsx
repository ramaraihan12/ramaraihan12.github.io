import type { Metadata } from "next";
import { ClothLazy } from "@/components/extras/cloth-lazy";
import { notFoundCopy } from "@/components/extras/not-found-copy";

/*
  GitHub Pages serves out/404.html for every address it has no file for, so this is a static page
  that can't know which address that was. The cloth reads it in the browser. Next puts this
  boundary in every page's tree, so the cloth is loaded on demand and the home page doesn't
  download it. It is still rendered on the server, so 404.html has the words and buttons before
  any script runs. The noindex comes from Next itself.
*/

export const metadata: Metadata = {
  title: `${notFoundCopy.title} · Rama Raihan`,
  // The home page's canonical and preview don't belong on a page that isn't one.
  alternates: { canonical: null },
};

export default function NotFound() {
  return (
    <main id="main">
      <ClothLazy />
    </main>
  );
}
