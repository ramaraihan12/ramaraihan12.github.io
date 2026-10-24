import type { CSSProperties } from "react";
import { batikDataUri, batikTileSize } from "@/components/art";
import { webCopy } from "@/content/copy";

// A data URI can't read CSS variables, so the dyes are spelled out: soga ground, mori blades,
// malam (wax) lines. Same values as tokens.css.
const SOGA = "#9c6633";
const MORI = "#efe9dc";
const MALAM = "#080e2b";
const SCALE = 0.5;

/**
 * Where the AI apps end and the web apps start, marked the way a sarong marks its kepala: a
 * band of a different motif across the cloth, here parang in soga, with a row of tumpal
 * teeth pointing into the next part.
 */
export function WebDivider() {
  const style = {
    "--kepala": batikDataUri("parang", { ink: MALAM, ground: SOGA, tint: MORI, scale: SCALE }),
    "--kepala-tile": `${batikTileSize("parang", SCALE)}px`,
  } as CSSProperties;

  return (
    <div className="panel run-divider" style={style}>
      <span className="kepala" aria-hidden="true" />
      <div className="run-divider-text">
        <p className="eyebrow">{webCopy.eyebrow}</p>
        <h2 id="web-title" className="display-l run-divider-title">
          {webCopy.title}
        </h2>
        <p className="lead run-divider-lead">{webCopy.lead}</p>
      </div>
    </div>
  );
}
