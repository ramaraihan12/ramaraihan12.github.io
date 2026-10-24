import type { CSSProperties } from "react";
import { batikTile } from "@/components/art/files";
import { webCopy } from "@/content/copy";

/**
 * Where the AI apps end and the web apps start, marked the way a sarong marks its kepala: a
 * band of a different motif across the cloth, here parang in soga, with a row of tumpal
 * teeth pointing into the next part. The cloth is the "web-kepala" tile in art/files.tsx: soga
 * ground, mori blades, malam (wax) lines.
 */
export function WebDivider() {
  const kepala = batikTile("web-kepala");
  const style = {
    "--kepala": kepala.css,
    "--kepala-tile": `${kepala.size}px`,
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
