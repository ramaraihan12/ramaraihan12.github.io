import { dot, type Pt, sampleCurve, smooth } from "@/components/art/draw";
import { rng, wobble } from "@/components/art/rng";

/*
  The geometry of the thread (src/components/benang). All of it is plain numbers in document
  pixels, so it can be measured once per ScrollTrigger refresh and read on every scroll without
  touching the DOM. Nothing here knows about GSAP.

  The thread is a function of height: wherever it is, it only goes down the page, so a point on
  it is found from a height by a table of lengths. Only the little hook that ties it into the
  work section's hint goes back up, and that is its own stretch at the end.
*/

/** The dot's diameter, and the answer's seed (circle(7px) in answer.css) it lands as. */
export const BEAD = 11;
export const SEED = 14;

/**
 * How many screens before the answer pins the dot has landed on the seed. The notes start
 * gathering round it from then (answer-stage.tsx), so the dot is down before they come.
 */
export const LAND = 0.4;

/** Where the dot leaves the map, in document pixels. `end` is the scroll where its pin lets go. */
export type QueryDot = { x: number; y: number; end: number };

let reader: (() => QueryDot | null) | null = null;

/** The opening scene says where the query dot is. Returns the call that takes that back. */
export function provideQueryDot(read: () => QueryDot | null) {
  reader = read;
  return () => {
    if (reader === read) reader = null;
  };
}

export function readQueryDot(): QueryDot | null {
  // The scene may be halfway through being rebuilt: it throws, or its pin isn't measured yet and
  // the numbers aren't (a phone turned back upright). The refresh that follows has them.
  try {
    const dot = reader?.() ?? null;
    return dot && Number.isFinite(dot.x) && Number.isFinite(dot.y) && Number.isFinite(dot.end) ? dot : null;
  } catch {
    return null;
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smoothstep = (t: number) => {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
};

/**
 * Margin of the page's container (src/styles/base.css: 1rem, 2rem from 40rem, 80rem wide),
 * which is the room the thread has on the left.
 */
export function gutterEdge(vw: number) {
  const pad = vw >= 640 ? 32 : 16;
  return Math.max(pad, (vw - 1280) / 2 + pad);
}

/** Where the thread runs down the left margin: the middle of it, never far from the text. */
export function threadX(vw: number) {
  const g = gutterEdge(vw);
  return Math.max(9, g - clamp(g / 2, 9, 56));
}

/** How far a hand strays from the line. Less on a phone, where there's no room to stray. */
function strayOf(vw: number) {
  return clamp((gutterEdge(vw) - 16) / 3, 1.2, 6);
}

export type Geo = {
  vw: number;
  vh: number;
  /** The thread's x in the margin, and the middle of the page where it lands. */
  xg: number;
  cx: number;
  /** The seed's height in the document, and the lowest height the thread may leave the margin at. */
  seedY: number;
  leaveY: number;
  /** Scroll where the answer pins. The seed is under the thread's end from here. */
  answerAt: number;
  dot: QueryDot;
  /** The work rail, where the pin holds the section and the hint's arrow is (viewport pixels at the pin's start). */
  rail: { start: number; end: number; hx: number; hy: number; lx: number } | null;
};

/** A straight run down the margin with a hand's wobble, from y0 to y1, one knot every `step`. */
function margin(y0: number, y1: number, g: Geo, r: () => number, step = 84): Pt[] {
  const amp = strayOf(g.vw);
  const out: Pt[] = [];
  for (let y = y0; y < y1 - step * 0.4; y += step) out.push([g.xg + wobble(r, amp), y]);
  return out;
}

/** The sweep from the margin to the seed: an S, vertical where it starts and where it lands. */
function sweep(g: Geo, r: () => number): Pt[] {
  const out: Pt[] = [];
  const h = g.seedY - g.leaveY;
  const n = Math.max(6, Math.round(h / 34));
  const amp = strayOf(g.vw) * 0.5;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = g.leaveY + h * t;
    const x = g.xg + (g.cx - g.xg) * smoothstep(t);
    out.push([i === n ? g.cx : x + wobble(r, amp * (1 - t)), y]);
  }
  return out;
}

/** The query dot's drip: it falls first, then leans toward the margin. */
function drip(g: Geo, r: () => number): Pt[] {
  const len = clamp(g.vh * 0.55, 240, 480);
  const out: Pt[] = [];
  const n = Math.round(len / 20);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = g.dot.x + (g.xg - g.dot.x) * smoothstep((t - 0.04) / 0.46);
    out.push([i === 0 ? g.dot.x : x + wobble(r, 1.2), g.dot.y + len * t]);
  }
  return out;
}

export type Route = {
  knots: Pt[];
  /** Path data of all of it, which the dot rides. */
  d: string;
  /** The thread without the drip, and the drip's wax dots as one path of circles. */
  thread: string;
  dotsD: string;
  /** Length run up to where the thread takes over from the dots. */
  threadAt: number;
  /** Where the visible thread starts in the knots (the dots before it), and the knot where the rail's hook begins. */
  threadFrom: number;
  hookAt: number;
  /** Dense samples of the curve: heights, and the length run up to each. Only the first `mono` go down. */
  ys: Float64Array;
  arc: Float64Array;
  mono: number;
  length: number;
};

export const PER = 6;

function tabulate(knots: Pt[], threadFrom: number, hookAt: number): Route {
  const dense = sampleCurve(knots, (knots.length - 1) * PER + 1);
  const ys = new Float64Array(dense.length);
  const arc = new Float64Array(dense.length);
  let run = 0;
  dense.forEach((p, i) => {
    if (i) run += Math.hypot(p[0] - dense[i - 1][0], p[1] - dense[i - 1][1]);
    ys[i] = p[1];
    arc[i] = run;
  });
  const mono = hookAt >= 0 ? hookAt * PER + 1 : dense.length;
  // The dots: one every 9px of the drip's own length, smaller as they go.
  let dotsD = "";
  const threadAt = threadFrom > 0 ? arc[threadFrom * PER] : 0;
  if (threadFrom > 0) {
    let next = 0;
    for (let i = 0; i < dense.length && arc[i] <= threadAt; i++) {
      if (arc[i] >= next) {
        dotsD += dot(dense[i][0], dense[i][1], 2.6 - 1.1 * (arc[i] / threadAt));
        next += 9;
      }
    }
  }
  const thread = threadFrom > 0 ? smooth(knots.slice(threadFrom)) : smooth(knots);
  return { knots, d: smooth(knots), thread, dotsD, threadAt, threadFrom, hookAt, ys, arc, mono, length: run };
}

/** Length run up to height y on the part of the curve that only goes down. */
export function arcAtY(route: Route, y: number): number {
  const { ys, arc, mono } = route;
  if (y <= ys[0]) return 0;
  if (y >= ys[mono - 1]) return arc[mono - 1];
  let lo = 0;
  let hi = mono - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ys[mid] <= y) lo = mid;
    else hi = mid;
  }
  const span = ys[hi] - ys[lo] || 1;
  return arc[lo] + ((arc[hi] - arc[lo]) * (y - ys[lo])) / span;
}

/** Route 1: from the query dot down the margin, then either into the rail's hint or all the way to the seed. */
export function routeFromDot(g: Geo, seed: number): Route {
  const r = rng(seed);
  const knots: Pt[] = drip(g, r);
  const threadFrom = knots.length - 1;
  const rail = g.rail;
  if (rail) {
    const hookY = rail.start + rail.hy + 40;
    // The section's text starts nearer the window's edge than the page's does, so inside it the
    // thread moves over to the edge and runs clear of the words, then hooks into the arrow.
    const ex = clamp(rail.lx - 11, 9, g.xg);
    const lean = rail.start + 90;
    const ge = { ...g, xg: ex };
    knots.push(...margin(knots[threadFrom][1] + 84, lean - 40, g, r));
    knots.push([g.xg, lean], [ex, lean + 190]);
    knots.push(...margin(lean + 270, hookY - 60, ge, r));
    knots.push([ex, hookY - 36]);
    const hookAt = knots.length;
    knots.push([ex + 0.1 * (rail.hx - ex), hookY]);
    // Along under the hint's words and up into the arrow.
    knots.push([ex + 0.5 * (rail.hx - ex), hookY + 7]);
    knots.push([rail.hx - 16, hookY - 2]);
    knots.push([rail.hx, rail.start + rail.hy + 12]);
    knots.push([rail.hx, rail.start + rail.hy]);
    return tabulate(knots, threadFrom, hookAt - 1);
  }
  knots.push(...margin(knots[threadFrom][1] + 84, g.leaveY, g, r));
  knots.push(...sweep(g, r));
  return tabulate(knots, threadFrom, -1);
}

/** Route 2: out of the margin's edge where the rail lets go, down to the seed. */
export function routeToSeed(g: Geo, fromY: number, seed: number): Route {
  const r = rng(seed);
  const knots: Pt[] = [
    [-14, fromY],
    [g.xg - 3, fromY + 30],
    [g.xg, fromY + 90],
  ];
  knots.push(...margin(fromY + 170, g.leaveY, g, r));
  knots.push(...sweep(g, r));
  return tabulate(knots, 0, -1);
}

/** The thread with nothing moving: down the margin from one height to another, ending in a knot. */
export function stillThread(g: Geo, y0: number, y1: number, seed: number): { d: string; end: Pt } {
  const r = rng(seed);
  const knots: Pt[] = [[g.xg, y0], ...margin(y0 + 84, y1 - 20, g, r), [g.xg, y1]];
  return { d: smooth(knots), end: [g.xg, y1] };
}

/*
  Scroll to dot. A map from scroll to how far along the route the dot is, as a table of
  (scroll, length) pairs. The dot rides the screen's middle (it holds its place in the window,
  so what it passes changes and it doesn't), and near the end of a stretch it runs ahead of the
  scroll to where it has to be: the rail's hint, or the seed.
*/

export type Ride = {
  /** Scroll where it starts and where it arrives. */
  from: number;
  to: number;
  /** Ascending scroll positions, and the fraction of the route (0..1) at each. */
  at: Float64Array;
  frac: Float64Array;
  /** Height the dot is at for a scroll, for the clip over the drip and for hiding it in the play section. */
  y: (s: number) => number;
};

/** Cubic Hermite through (a, ya) with slope ma to (b, yb) with slope mb, at s. */
function hermite(s: number, a: number, ya: number, ma: number, b: number, yb: number, mb: number) {
  const h = b - a;
  const t = clamp((s - a) / h, 0, 1);
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * ya + (t3 - 2 * t2 + t) * h * ma + (-2 * t3 + 3 * t2) * yb + (t3 - t2) * h * mb;
}

export function makeRide(
  route: Route,
  o: {
    /** Scroll at which the dot is at the start of the route, and at the end of it. */
    from: number;
    to: number;
    /** Height of the route's start, and where the dot sits in the window while it rides (px from the top). */
    startY: number;
    hold: number;
    /** Where the ride-along ends and the run ahead begins, and the height it ends at (the hook, or the seed). */
    runFrom: number;
    runTo: number;
    endY: number;
    /** With a hook: the scroll at which the hook begins, which is where the run ahead has got to. */
    hookFrom?: number;
  },
): Ride {
  const { from, to } = o;
  const blend = Math.max(1, (to - from) * 0.12);
  const startHold = o.startY - from;
  const ride = (s: number) => s + startHold + (o.hold - startHold) * smoothstep((s - from) / blend);
  const runFrom = clamp(o.runFrom, from, o.runTo - 1);
  const arrive = o.hookFrom ?? o.runTo;
  const y = (s: number) => {
    if (s <= runFrom) return ride(s);
    if (s >= arrive) return o.endY;
    return hermite(s, runFrom, ride(runFrom), 1, arrive, o.endY, 0);
  };
  const n = Math.max(2, Math.ceil((to - from) / 10));
  const at = new Float64Array(n + 1);
  const frac = new Float64Array(n + 1);
  const hookStart = o.hookFrom !== undefined ? arcAtY(route, o.endY) : 0;
  for (let i = 0; i <= n; i++) {
    const s = from + ((to - from) * i) / n;
    at[i] = s;
    if (o.hookFrom !== undefined && s >= o.hookFrom) {
      const t = smoothstep((s - o.hookFrom) / Math.max(1, to - o.hookFrom));
      frac[i] = (hookStart + (route.length - hookStart) * t) / route.length;
    } else {
      frac[i] = arcAtY(route, y(s)) / route.length;
    }
  }
  return { from, to, at, frac, y };
}

/** Fraction of the route at scroll s, from a ride's table. */
export function fracAt(ride: Ride, s: number): number {
  const { at, frac } = ride;
  if (s <= at[0]) return frac[0];
  const last = at.length - 1;
  if (s >= at[last]) return frac[last];
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (at[mid] <= s) lo = mid;
    else hi = mid;
  }
  return frac[lo] + ((frac[hi] - frac[lo]) * (s - at[lo])) / (at[hi] - at[lo] || 1);
}
