import { type Rand, wobble } from "./rng";

/*
  Path writing for hand-drawn SVG. Numbers are rounded and written short (".5", "-3"), since
  every path here ends up inline in the HTML or inside a data URI.
*/

export type Pt = readonly [number, number];

/** A number for path data: `digits` decimals, no leading zero, no "-0". */
export function num(v: number, digits = 1): string {
  const k = 10 ** digits;
  const s = String(Math.round(v * k) / k);
  if (s === "-0") return "0";
  return s.replace(/^(-?)0\./, "$1.");
}

/** Numbers joined the way path data allows: a space between them, none before a minus. */
export function nums(values: readonly number[], digits = 1): string {
  let out = "";
  for (const v of values) {
    const s = num(v, digits);
    out += out && s[0] !== "-" ? ` ${s}` : s;
  }
  return out;
}

/**
 * A smooth curve through the points (uniform Catmull-Rom, written as cubic Béziers). The
 * tangents are symmetric at every point, so all segments after the first use the short "S".
 */
export function smooth(points: readonly Pt[], closed = false, digits = 1): string {
  const n = points.length;
  if (n < 2) return "";
  const at = (i: number) => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))]);
  const tangent = (i: number): Pt => {
    const a = at(i - 1);
    const b = at(i + 1);
    return [(b[0] - a[0]) / 6, (b[1] - a[1]) / 6];
  };
  let d = `M${nums(points[0], digits)}`;
  const segments = closed ? n : n - 1;
  for (let i = 0; i < segments; i++) {
    const p1 = at(i);
    const p2 = at(i + 1);
    const t2 = tangent(i + 1);
    const c2 = [p2[0] - t2[0], p2[1] - t2[1], p2[0], p2[1]];
    if (i === 0) {
      const t1 = tangent(i);
      d += `C${nums([p1[0] + t1[0], p1[1] + t1[1], ...c2], digits)}`;
    } else {
      d += `S${nums(c2, digits)}`;
    }
  }
  return closed ? `${d}Z` : d;
}

/** Straight segments through the points. */
export function poly(points: readonly Pt[], closed = false, digits = 1): string {
  return points.map((p, i) => `${i ? "L" : "M"}${nums(p, digits)}`).join("") + (closed ? "Z" : "");
}

/** Moves every point a little, like a hand that doesn't quite hold the line. */
export function jitter(points: readonly Pt[], r: Rand, amount: number): Pt[] {
  return points.map(([x, y]) => [x + wobble(r, amount), y + wobble(r, amount)] as const);
}

/**
 * An ellipse drawn the way a canting draws it: four arcs whose radii and handles drift a little.
 * `a` runs along `angle`, `b` across it. A `tip` below 0.55 sharpens the two ends of the long
 * axis into a slight point, like a kawung petal.
 */
export function petal(
  cx: number,
  cy: number,
  a: number,
  b: number,
  angle: number,
  r: Rand,
  { drift = 0.05, tip = 0.5, digits = 1 }: { drift?: number; tip?: number; digits?: number } = {},
): string {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const to = (x: number, y: number): [number, number] => [cx + x * cos - y * sin, cy + x * sin + y * cos];
  const k = 0.5523;
  // Anchors at the four ends of the axes, each nudged out or in.
  const ra = [a, b, a, b].map((v) => v * (1 + wobble(r, drift)));
  const anchors = [
    [ra[0], 0],
    [0, ra[1]],
    [-ra[2], 0],
    [0, -ra[3]],
  ];
  // Handle direction at each anchor is along the curve, length by the neighbouring radius.
  const handle = (i: number) => {
    const long = i % 2 === 0;
    const len = (long ? ra[1] * tip : ra[0] * k) * (1 + wobble(r, drift));
    const dir = [
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 0],
    ][i];
    return [dir[0] * len, dir[1] * len];
  };
  const hs = anchors.map((_, i) => handle(i));
  let d = `M${nums(to(anchors[0][0], anchors[0][1]), digits)}`;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const c1 = to(anchors[i][0] + hs[i][0], anchors[i][1] + hs[i][1]);
    const c2 = to(anchors[j][0] - hs[j][0], anchors[j][1] - hs[j][1]);
    const p = to(anchors[j][0], anchors[j][1]);
    d += i === 0 ? `C${nums([...c1, ...c2, ...p], digits)}` : `S${nums([...c2, ...p], digits)}`;
  }
  return `${d}Z`;
}

/** A circle as path data, so many can share one <path>. */
export function dot(cx: number, cy: number, radius: number, digits = 1): string {
  const r = num(radius, digits);
  return `M${nums([cx - radius, cy], digits)}a${r} ${r} 0 1 0 ${num(radius * 2, digits)} 0a${r} ${r} 0 1 0 ${num(-radius * 2, digits)} 0`;
}

/**
 * A filled stroke that swells and thins along a spine, the way a brush or canting leaves a
 * line. `width(t)` gives the full width at t in [0, 1].
 */
export function taper(spine: readonly Pt[], width: (t: number) => number, samples = 14, digits = 1): string {
  const pts = sampleCurve(spine, samples);
  const left: Pt[] = [];
  const right: Pt[] = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / len;
    const ny = (b[0] - a[0]) / len;
    const w = width(i / (pts.length - 1)) / 2;
    left.push([p[0] + nx * w, p[1] + ny * w]);
    right.push([p[0] - nx * w, p[1] - ny * w]);
  });
  return smooth([...left, ...right.reverse()], true, digits);
}

/** Points along the Catmull-Rom curve through `spine`. */
export function sampleCurve(spine: readonly Pt[], samples: number): Pt[] {
  const n = spine.length;
  const at = (i: number) => spine[Math.max(0, Math.min(n - 1, i))];
  const out: Pt[] = [];
  for (let s = 0; s < samples; s++) {
    const u = (s / (samples - 1)) * (n - 1);
    const i = Math.min(n - 2, Math.floor(u));
    const t = u - i;
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const t2 = t * t;
    const t3 = t2 * t;
    const f = (k: 0 | 1) =>
      0.5 *
      (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
    out.push([f(0), f(1)]);
  }
  return out;
}

/**
 * A line from a to b that bends and wavers a little, for frames and rules. The ends stay put,
 * so lines that meet at corners still meet.
 */
export function wavy(a: Pt, b: Pt, r: Rand, amount: number, steps = 4): Pt[] {
  const pts: Pt[] = [a];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const nx = -(b[1] - a[1]) / len;
  const ny = (b[0] - a[0]) / len;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const o = wobble(r, amount);
    pts.push([a[0] + (b[0] - a[0]) * t + nx * o, a[1] + (b[1] - a[1]) * t + ny * o]);
  }
  pts.push(b);
  return pts;
}

/**
 * A rectangle drawn by hand, one side at a time: each side wavers, and the ends run a little
 * past the corners, the way lines cross when you draw a box without lifting much.
 */
export function handRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: Rand,
  { wave = 1, over = 0, digits = 1 }: { wave?: number; over?: number; digits?: number } = {},
): string {
  const c = (px: number, py: number): Pt => [px + wobble(r, wave * 0.5), py + wobble(r, wave * 0.5)];
  const corners = [c(x, y), c(x + w, y), c(x + w, y + h), c(x, y + h)];
  return corners
    .map((p, i) => {
      const q = corners[(i + 1) % 4];
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      const ux = (q[0] - p[0]) / len;
      const uy = (q[1] - p[1]) / len;
      const o1 = over * (0.4 + r());
      const o2 = over * (0.4 + r());
      const a: Pt = [p[0] - ux * o1, p[1] - uy * o1];
      const b: Pt = [q[0] + ux * o2, q[1] + uy * o2];
      return smooth(wavy(a, b, r, wave, Math.max(2, Math.round(len / 45))), false, digits);
    })
    .join("");
}
