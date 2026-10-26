import type { CSSProperties } from "react";
import type { BatikKind } from "@/components/art";
import { BATIK_KINDS, batikSvg } from "@/components/art/patterns";

/*
  The cloth a run of Closer leaves behind. Every right call dyes one more panel, so a run is a
  batik tambal: the patchwork cloth, a field of kawung next to a field of parang next to one
  of truntum. The question changes every few pairs and the motif follows it, so the cloth
  shows where the questions changed. How close the call was is the dye: a calm soga and mori
  on nila for an easy one, bright kunyit for a call that was nearly a coin toss.

  Drawing: each panel is an empty box and CSS paints it. The motifs come from the art kit as
  masks, two per kind (the wax lines, and the bodies the dye soaks into), so the colours are
  tokens in game.css and every panel of a kind shares the same two tiles. Six small SVGs for a
  whole run, however long, and no SVG in the DOM at all. Panels of one run of a kind line their
  masks up, so three kawung panels read as one field cut into three, not three stickers.

  The newest panel animates in by itself (game.css): it unrolls, the wax line spreads, then
  the dye soaks in. Keys are the index, so the panels already there are left alone.
*/

export type Motif = {
  kind: BatikKind;
  /** 0 to 1: 1 is the closest call won. */
  heat: number;
};

export type ClothProps = {
  motifs: readonly Motif[];
  /** The game-over keepsake: the whole cloth, larger, wrapped into rows, hemmed at both ends. */
  final?: boolean;
  className?: string;
};

/** Three dyes, so the cloth stays a few clear colours instead of a gradient of mud. */
type Dye = "calm" | "warm" | "hot";

function dyeOf(heat: number): Dye {
  if (heat >= 0.72) return "hot";
  if (heat >= 0.4) return "warm";
  return "calm";
}

/** The tile as a CSS url(), the same encoding batikDataUri uses. Only black matters in a mask. */
function maskUri(svg: string) {
  return `url("data:image/svg+xml,${svg.replace(/"/g, "'").replace(/[\r\n%#<>?[\\\]^`{|}]/g, encodeURIComponent)}")`;
}

let masks: CSSProperties | null = null;

/*
  Drawn once, the first time a cloth is shown. The body tile is the motif with its ink set to
  "none", which leaves the line paths in the file with nothing to paint, so they're cut out.
*/
function weave(): CSSProperties {
  if (masks) return masks;
  const vars: Record<string, string> = {};
  for (const kind of BATIK_KINDS) {
    vars[`--cl-${kind}-line`] = maskUri(batikSvg(kind, { ink: "#000", ground: "none" }));
    vars[`--cl-${kind}-body`] = maskUri(
      batikSvg(kind, { ink: "none", ground: "none", tint: "#000" }).replace(/<path d="[^"]*" fill="none"[^>]*\/>/g, ""),
    );
  }
  masks = vars as CSSProperties;
  return masks;
}

/** How far into its run of one kind each panel is: 0 where the cloth starts or the kind changes. */
function runs(motifs: readonly Motif[]) {
  const out: number[] = [];
  motifs.forEach((m, i) => out.push(i > 0 && motifs[i - 1].kind === m.kind ? out[i - 1] + 1 : 0));
  return out;
}

export function Cloth({ motifs, final = false, className }: ClothProps) {
  const run = runs(motifs);
  const panels = motifs.map((m, i) => {
    const turn = i > 0 && run[i] === 0;
    const heat = Math.min(1, Math.max(0, m.heat || 0));
    return (
      <span
        // A panel never moves once dyed, so its place in the run is its identity.
        key={i}
        className="cl-cloth-panel"
        data-kind={m.kind}
        data-dye={dyeOf(heat)}
        data-turn={turn || undefined}
        style={{ "--i": i, "--run": run[i], "--heat": heat } as CSSProperties}
      />
    );
  });

  return (
    <div
      className={className ? `cl-cloth ${className}` : "cl-cloth"}
      data-final={final || undefined}
      data-empty={motifs.length === 0 || undefined}
      style={weave()}
      aria-hidden="true"
    >
      {final && <span className="cl-cloth-hem" />}
      <span className="cl-cloth-field">
        <span className="cl-cloth-track">{panels}</span>
      </span>
      {final && <span className="cl-cloth-hem" />}
    </div>
  );
}
