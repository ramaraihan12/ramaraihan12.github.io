import type { CSSProperties, ReactNode } from "react";

/*
  Duotone in two dyes: the photo's shadows go nila and its highlights kunyit, as if the
  picture had been dyed like the cloth. The filter takes luminance, then maps it along a
  straight line from one color to the other (a third, middle color is optional).
*/

type RGB = [number, number, number];

function parseHex(hex: string): RGB {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`DuotoneFilter needs hex colors, got "${hex}"`);
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const round = (v: number) => Math.round(v * 1000) / 1000;

export type DuotoneFilterProps = {
  /** Referenced from CSS as url(#id). Default "duotone-nila-kunyit", which art.css uses. */
  id?: string;
  /** Hex, where the darks go. Default nila. */
  shadow?: string;
  /** Hex, where the lights go. Default kunyit. */
  highlight?: string;
  /** Optional hex for the midtones, e.g. soga for a warmer middle. */
  mid?: string;
};

/**
 * A hidden SVG holding the duotone filter. Render it once on the page, then use the .duotone
 * class (or <Duotone>) from art.css. Colors must be hex: filter tables can't read CSS variables.
 */
export function DuotoneFilter({ id = "duotone-nila-kunyit", shadow = "#0f1a47", highlight = "#f4b223", mid }: DuotoneFilterProps) {
  const stops = [shadow, ...(mid ? [mid] : []), highlight].map(parseHex);
  const table = (k: 0 | 1 | 2) => stops.map((c) => round(c[k])).join(" ");
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <filter id={id} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
        {/* Rec. 709 luminance into every channel. */}
        <feColorMatrix
          type="matrix"
          values="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0"
        />
        <feComponentTransfer>
          <feFuncR type="table" tableValues={table(0)} />
          <feFuncG type="table" tableValues={table(1)} />
          <feFuncB type="table" tableValues={table(2)} />
        </feComponentTransfer>
      </filter>
    </svg>
  );
}

export type DuotoneProps = {
  /** One image (an <img> or next/image). It's rendered twice: in color, and dyed on top. */
  children: ReactNode;
  /** Which DuotoneFilter to use. */
  filterId?: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * The image in color with a dyed copy over it. The copy fades out on hover or focus (of the
 * wrapper or anything inside it), so the photo returns to its own colors smoothly. The copy is
 * aria-hidden, so the alt text is read once.
 */
export function Duotone({ children, filterId = "duotone-nila-kunyit", className, style }: DuotoneProps) {
  return (
    <span
      className={className ? `duotone-fade ${className}` : "duotone-fade"}
      style={{ "--duotone-filter": `url(#${filterId})`, ...style } as CSSProperties}
    >
      {children}
      <span className="duotone-fade-tint" aria-hidden="true">
        {children}
      </span>
    </span>
  );
}
