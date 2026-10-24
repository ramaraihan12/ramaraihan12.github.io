/*
  Places the 2D projection from retrieval.json into an SVG viewBox. Shared by the poster (in the
  first load) and the game map (loaded later), so keep it tiny.
*/

export type Pt = { x: number; y: number };

/** Both SVGs use the same box, so the poster and the game line up when one replaces the other. */
export const VIEW = { w: 400, h: 280 } as const;

export type Projection = {
  /** Data space to viewBox. The data's y points up, the SVG's down. */
  at: (p: Pt) => Pt;
  /** The part of data space that's on screen, for the grid marks. */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
};

/** Fits `points` into the view with `pad` units around them, never zooming in past `minSpan`. */
export function project(points: Pt[], pad = 28, minSpan = 0.5): Projection {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const spanX = Math.max(Math.max(...xs) - Math.min(...xs), minSpan);
  const spanY = Math.max(Math.max(...ys) - Math.min(...ys), minSpan);
  const s = Math.min((VIEW.w - pad * 2) / spanX, (VIEW.h - pad * 2) / spanY);
  const halfW = VIEW.w / 2 / s;
  const halfH = VIEW.h / 2 / s;
  return {
    at: (p) => ({ x: VIEW.w / 2 + (p.x - cx) * s, y: VIEW.h / 2 - (p.y - cy) * s }),
    bounds: { minX: cx - halfW, maxX: cx + halfW, minY: cy - halfH, maxY: cy + halfH },
  };
}

/** Faint plus marks every `step` units, so the space reads as a plot and not a starfield. */
export function gridPath({ at, bounds }: Projection, step = 0.25, arm = 3) {
  let d = "";
  for (let gx = Math.ceil(bounds.minX / step) * step; gx <= bounds.maxX; gx += step) {
    for (let gy = Math.ceil(bounds.minY / step) * step; gy <= bounds.maxY; gy += step) {
      const p = at({ x: gx, y: gy });
      d += `M${r(p.x - arm)} ${r(p.y)}h${arm * 2}M${r(p.x)} ${r(p.y - arm)}v${arm * 2}`;
    }
  }
  return d;
}

/** One decimal is plenty in a 400 wide box, and keeps the server HTML short. */
export const r = (v: number) => Math.round(v * 10) / 10;
