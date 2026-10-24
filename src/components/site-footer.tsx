import type { CSSProperties } from "react";
import { batikDataUri, batikTileSize } from "@/components/art/patterns";
import { footerCopy } from "@/content/copy";
import { site } from "@/content/site";

// The page ends like a length of batik does, on a hem: one row of parang, in soga and kunyit.
const HEM_SCALE = 0.25;
const hem = {
  "--hem": batikDataUri("parang", { ink: "#f4b223", ground: "#080e2b", tint: "#9c6633", scale: HEM_SCALE }),
  "--hem-size": `${batikTileSize("parang", HEM_SCALE)}px`,
} as CSSProperties;

export function SiteFooter() {
  return (
    <footer className="site-footer" style={hem}>
      <div className="container-page site-footer-inner">
        <p>{footerCopy.copyright(new Date().getFullYear())}</p>
        <p>
          {footerCopy.colors} <a href={site.source}>{footerCopy.source}</a>
        </p>
      </div>
    </footer>
  );
}
