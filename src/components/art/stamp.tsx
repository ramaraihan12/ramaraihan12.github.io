import type { CSSProperties, ReactNode } from "react";
import { handRect } from "./draw";
import { hash, rng, wobble } from "./rng";

/*
  A label pressed onto the page like a batik cap, the copper stamp that prints wax in one go.
  The frame is drawn by hand from a seed (the label's text by default), the ink is a little
  uneven (a grain mask in art.css), and each stamp sits at its own slight angle.

  The press itself is CSS, driven by the caller through data-state:
    stamped  at rest, already printed (default, and what reduced motion always shows)
    ready    lifted and invisible, waiting to be pressed
    pressed  plays the press once: drops, squashes, ink spreads, settles
    scrub    follows --press from 0 (lifted) to 1 (printed), for scroll timelines
*/

export type CapStampState = "stamped" | "ready" | "pressed" | "scrub";

export type CapStampProps = {
  children: ReactNode;
  /** kunyit (default), mori, nila, soga, or any CSS color. */
  ink?: "kunyit" | "mori" | "nila" | "soga" | (string & {});
  /** rect (default) or round ends. */
  shape?: "rect" | "round";
  /** Initial state for the server render. Change it later with el.dataset.state. */
  state?: CapStampState;
  /** Seed for the frame's wobble and the tilt. Defaults to the text of children. */
  seed?: string;
  className?: string;
  style?: CSSProperties;
};

const INKS: Record<string, string> = {
  kunyit: "var(--kunyit, #f4b223)",
  mori: "var(--mori, #efe9dc)",
  nila: "var(--nila, #0f1a47)",
  soga: "var(--soga, #8a5a2b)",
};

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return "";
}

/** A stamped label. The label text stays real text; the frame is aria-hidden. */
export function CapStamp({ children, ink = "kunyit", shape = "rect", state = "stamped", seed, className, style }: CapStampProps) {
  const key = seed ?? (textOf(children) || "cap");
  const r = rng(hash(key));
  const tilt = Math.round(wobble(r, 2.6) * 10) / 10;
  // Drawn in a 100 × 40 box and stretched to the label; non-scaling strokes keep the line even.
  const outer = shape === "round" ? roundFrame(r, 2) : handRect(2, 2, 96, 36, r, { wave: 1.1, over: 1.6 });
  const inner = shape === "round" ? roundFrame(r, 6) : handRect(5.5, 7, 89, 26, r, { wave: 0.8 });

  return (
    <span
      className={className ? `cap-stamp ${className}` : "cap-stamp"}
      data-state={state}
      data-shape={shape}
      style={{ "--cap-ink": INKS[ink] ?? ink, "--cap-tilt": `${tilt}deg`, ...style } as CSSProperties}
    >
      <svg className="cap-stamp-frame" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d={outer} vectorEffect="non-scaling-stroke" strokeWidth="1.7" />
        <path d={inner} vectorEffect="non-scaling-stroke" strokeWidth="0.9" />
      </svg>
      <span className="cap-stamp-label">{children}</span>
    </span>
  );
}

/** A pill outline: two half-rounds joined by wavy sides. */
function roundFrame(r: ReturnType<typeof rng>, inset: number) {
  const y0 = inset;
  const y1 = 40 - inset;
  const ry = (y1 - y0) / 2;
  const rx = ry * 0.4;
  const j = () => Math.round(wobble(r, 0.8) * 10) / 10;
  const x0 = inset + rx;
  const x1 = 100 - inset - rx;
  return `M${x0} ${y0 + j()}C${40 + j()} ${y0 + j()} ${60 + j()} ${y0 + j()} ${x1} ${y0}A${rx} ${ry} 0 0 1 ${x1} ${y1}C${60 + j()} ${y1 + j()} ${40 + j()} ${y1 + j()} ${x0} ${y1}A${rx} ${ry} 0 0 1 ${x0} ${y0 + 0.6}`;
}
