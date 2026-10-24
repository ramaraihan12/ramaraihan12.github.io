/*
  The design tokens in src/styles/tokens.css, read at runtime, so canvas code draws with the same
  colors as the stylesheet instead of a copy of their hex values. These read computed styles, so
  call them in the browser (an effect, a constructor run from one), never while rendering on the
  server, and not on every frame: read once, keep the result.
*/

/** A custom property as computed on :root (or on el), trimmed. "" when it isn't set. */
export function cssVar(name: string, el: Element = document.documentElement): string {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

let probe: CanvasRenderingContext2D | null = null;

/**
 * A color token as sRGB channels, like "244 178 35", for drawing it at any opacity with rgba().
 * The browser parses the value, so hex, rgb() and color-mix() tokens all work. The token's own
 * alpha is dropped. "" when the token isn't set or isn't a color.
 */
export function cssColor(name: string, el?: Element): string {
  const value = cssVar(name, el);
  if (!value || !CSS.supports("color", value)) return "";
  probe ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!probe) return "";
  probe.fillStyle = value;
  // Canvas hands sRGB colors back as #rrggbb, or as rgba() when they're translucent.
  const parsed = String(probe.fillStyle);
  if (parsed.startsWith("#")) return [1, 3, 5].map((i) => parseInt(parsed.slice(i, i + 2), 16)).join(" ");
  const rgb = parsed.match(/^rgba?\((\d+), (\d+), (\d+)/);
  if (rgb) return rgb.slice(1).join(" ");
  // Anything else, like the oklab() a color-mix() turns into: paint a pixel and read it back.
  probe.clearRect(0, 0, 1, 1);
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return `${r} ${g} ${b}`;
}

/** A canvas-ready color from cssColor()'s channels: rgba(cssColor("--kunyit"), 0.5). */
export const rgba = (channels: string, alpha: number) => `rgb(${channels} / ${alpha})`;
