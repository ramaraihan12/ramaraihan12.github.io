import type { CSSProperties } from "react";
import { batikTile } from "@/components/art/files";
import { footerCopy } from "@/content/copy";
import { site } from "@/content/site";

// The page ends like a length of batik does, on a hem: one row of parang, in soga and kunyit.
const hemTile = batikTile("footer-hem");
const hem = {
  "--hem": hemTile.css,
  "--hem-size": `${hemTile.size}px`,
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
