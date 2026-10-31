import { dyeScale, type KawungLayout, kawungLayout } from "@/components/art/kawung-field";
import { rng } from "@/components/art/rng";
import type retrievalData from "@/content/retrieval.json";
import { cssColor, rgba } from "./tokens";

type Retrieval = typeof retrievalData;
type Point = { x: number; y: number };
type Camera = { cx: number; cy: number; s: number };
export type Region = { x: number; y: number; w: number; h: number };

/**
 * Where the map sits, in canvas pixels. `region` holds the whole map once the camera has pulled
 * back. `anchor` is where the query sits while the camera is still zoomed in on it, which is
 * where the scene lands the tokens and the sun. Left out, the query stays in its spot in the region.
 */
export type Frame = { region: Region; anchor?: Point };

/** Everything the scroll timeline animates. All values run from 0 to 1. */
export type MapState = {
  /** How far out from the query the notes have appeared. */
  bloom: number;
  alpha: number;
  /** The query dot itself. */
  query: number;
  /** 0 is zoomed in on the query, 1 shows the whole map. */
  cam: number;
  /**
   * The cloth gathering into the notes. 0 is the cloth whole, and the first half of the run is
   * the iris closing over it. Every note takes the cloth flower nearest it, and the flower
   * flies there as the iris passes it and shrinks into the note's dot.
   */
  gather: number;
  /** 1 once the dot has left the map to ride the page's thread (src/components/benang). */
  exit: number;
  /** One per retrieved note, draws the line out to it. */
  hits: { v: number }[];
};

/** How much of the gather the iris takes to close. The scene's iris tween is this share of it. */
export const IRIS_SHARE = 0.5;
/** How long, as a share of the gather, one flower is in the air. */
const FLIGHT = 0.5;

/** The ground's grid, in PCA units. A truntum flower sits on every point of it. */
const GRID = 0.25;
/** Space between the wax dots of a hit line, in pixels. */
const DOT_GAP = 6;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const TAU = Math.PI * 2;

/** One flower of the truntum ground: where it sits, how it's turned and how big. */
type Flower = Point & { turn: number; size: number; loose: boolean };

/** A cloth flower on its way to a note. */
type Donor = {
  note: number;
  flower: number;
  launch: number;
  bow: number;
  /** Aims at the note's place on the finished map and waits there, for the camera to bring the dot to it. */
  rest: boolean;
  /** Where round that place it waits, so a note's flowers don't sit on one another. */
  nudge: Point;
};

/** Where a group label may sit, nearest its centre first. */
const SPOTS: (Point & { r: number })[] = [{ x: 0, y: 0, r: 0 }];
for (const r of [14, 24, 36, 50, 66, 86, 110, 140]) {
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU + (r % 5) * 0.2;
    SPOTS.push({ x: Math.cos(a) * r * 1.7, y: Math.sin(a) * r, r });
  }
}

/**
 * Draws the notes as dots in the 2D projection from scripts/embed_notes.py, on a faint truntum
 * ground, like a map drawn on cloth. The question is a glowing turmeric dot, and dotted canting
 * lines run out from it to the retrieved notes, each ringed in wax with its rank. The canvas only
 * paints; the scene owns the timeline and calls draw() every frame while it's on screen.
 */
export class EmbeddingMap {
  state: MapState;
  /** Index into data.points of the note under the pointer (or a hovered card), -1 for none. */
  highlight = -1;

  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private near: Camera = { cx: 0, cy: 0, s: 1 };
  private far: Camera = { cx: 0, cy: 0, s: 1 };
  private reach = 1;
  private font = "monospace";
  /** The page's tokens, as channels for rgba(). */
  private colors = {
    mori: cssColor("--mori"),
    pudar: cssColor("--pudar"),
    kunyit: cssColor("--kunyit"),
    soga: cssColor("--soga-2") || cssColor("--soga"),
  };
  /** The cloth the question drew, laid out in this canvas, and which flower each note takes. */
  private cloth: KawungLayout | null = null;
  /** How near each note sits to the question on the map, 0 to 1. The map's own distance, not the cosine. */
  private close: number[] = [];
  /** The flower each note takes, and a few more that fly to the same dot from across the stage. */
  private donors: Donor[] = [];
  private extras: Donor[] = [];
  /** Group labels, placed once per resize: the offset from the group's centre, in map units. */
  private labels: { name: string; at: Point; off: Point; w: number }[] = [];
  private region: Region = { x: 0, y: 0, w: 0, h: 0 };
  private groups: { name: string; x: number; y: number }[];
  private bounds: { minX: number; maxX: number; minY: number; maxY: number };
  private hitIndex: number[];
  private ground: Flower[] = [];
  /** A little hand in every mark: per-note dot sizes, per-hit line bow and dot sizes, ring wobble. */
  private hand: { dots: number[]; bows: number[]; grains: number[]; rings: number[][] };

  constructor(
    private canvas: HTMLCanvasElement,
    private data: Retrieval,
    private frame: (w: number, h: number) => Frame,
    private zoom = 2.6,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.hitIndex = data.top.map((t) => t.index);
    this.state = {
      bloom: 0,
      alpha: 0,
      query: 0,
      cam: 0,
      gather: 0,
      exit: 0,
      hits: data.top.map(() => ({ v: 0 })),
    };

    const q = data.query;
    this.reach = Math.max(...data.points.map((p) => Math.hypot(p.x - q.x, p.y - q.y)));

    this.close = data.points.map((p) => 1 - Math.hypot(p.x - q.x, p.y - q.y) / this.reach);

    const sums = new Map<string, { x: number; y: number; n: number }>();
    for (const p of data.points) {
      const g = sums.get(p.group) ?? { x: 0, y: 0, n: 0 };
      sums.set(p.group, { x: g.x + p.x, y: g.y + p.y, n: g.n + 1 });
    }
    this.groups = [...sums].map(([name, g]) => ({ name, x: g.x / g.n, y: g.y / g.n }));

    const all = [...data.points, q];
    const xs = all.map((p) => p.x);
    const ys = all.map((p) => p.y);
    this.bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };

    // Seeded, so the cloth looks the same on every visit.
    const r = rng(1024);
    this.hand = {
      dots: data.points.map(() => 0.85 + r() * 0.3),
      bows: data.top.map((_, i) => (i % 2 ? -1 : 1) * (0.06 + r() * 0.06)),
      grains: Array.from({ length: 64 }, () => r()),
      rings: data.top.map(() => Array.from({ length: 14 }, () => r() * 2 - 1)),
    };

    // Truntum on a half-drop grid over the whole map and a margin round it, a few loose dots
    // between the flowers like the scattered stars of the real motif.
    const { minX, maxX, minY, maxY } = this.bounds;
    const x0 = Math.floor(minX / GRID) * GRID - GRID;
    const y0 = Math.floor(minY / GRID) * GRID - GRID;
    for (let col = 0; x0 + (col * GRID) / 2 <= maxX + GRID; col++) {
      for (let row = 0; y0 + row * GRID <= maxY + GRID; row++) {
        const x = x0 + (col * GRID) / 2;
        const y = y0 + row * GRID + (col % 2 ? GRID / 2 : 0);
        const jitter = () => (r() - 0.5) * 0.03;
        this.ground.push({ x: x + jitter(), y: y + jitter(), turn: r() * TAU, size: 0.8 + r() * 0.35, loose: false });
        if (r() < 0.6) {
          this.ground.push({ x: x + GRID / 4 + jitter() * 2, y: y + GRID / 2 + jitter() * 2, turn: 0, size: 1, loose: true });
        }
      }
    }
  }

  /** Shows the finished map, for reduced motion. */
  complete() {
    Object.assign(this.state, { bloom: 1, alpha: 1, query: 1, cam: 1, gather: 1 });
    this.state.hits.forEach((h) => (h.v = 1));
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.w = rect.width;
    this.h = rect.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);

    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-martian");
    this.font = family.trim() || "monospace";

    const { region, anchor } = this.frame(this.w, this.h);
    this.region = region;
    this.near = this.fit(region);
    // Zoomed in around the query, which sits at the anchor until the camera pulls back.
    const q = this.data.query;
    const at = anchor ?? this.toScreen(q, this.near);
    const s = this.near.s * this.zoom;
    this.far = { cx: at.x - q.x * s, cy: at.y + q.y * s, s };
    this.layCloth();
    this.layLabels();
  }

  /**
   * Finds the cloth's flowers in this canvas and gives every note one. Nearest notes choose
   * first, from the flower closest to where the note sits while the camera is zoomed in (a note
   * out of frame takes one at the edge, so the outer cloth peels off first).
   */
  private layCloth() {
    const { w, h, data } = this;
    const a = this.queryScreen();
    const cloth = kawungLayout(data.queryVector, w, h, undefined, { x: a.x / (w || 1), y: a.y / (h || 1) });
    this.cloth = cloth;
    const reach = Math.hypot(Math.max(a.x, w - a.x), Math.max(a.y, h - a.y)) || 1;
    const q = data.query;
    const taken = new Set<number>();
    const r = rng(77);
    this.donors = [];
    this.extras = [];
    // The iris closes as 1 - g squared, so it passes a flower at this distance when g is
    // sqrt(1 - distance / reach): that is when the flower leaves.
    const launchOf = (f: number) => {
      const dn = clamp01(Math.hypot(cloth.seeds[f].x - a.x, cloth.seeds[f].y - a.y) / reach);
      return IRIS_SHARE * Math.sqrt(1 - dn);
    };
    const nearest = (tx: number, ty: number) => {
      let best = -1;
      let bestD = Infinity;
      for (let f = 0; f < cloth.flowers; f++) {
        if (taken.has(f)) continue;
        const d = Math.hypot(cloth.seeds[f].x - tx, cloth.seeds[f].y - ty);
        if (d < bestD) {
          best = f;
          bestD = d;
        }
      }
      return best;
    };
    const order = data.points.map((_, i) => i).sort((i, j) => this.reachOf(i, q) - this.reachOf(j, q));
    for (const i of order) {
      const t = this.toScreen(data.points[i], this.far);
      let best = nearest(Math.min(w, Math.max(0, t.x)), Math.min(h, Math.max(0, t.y)));
      if (best < 0) best = 0;
      taken.add(best);
      // A note that is off the stage while the camera is zoomed in has nowhere to fly to yet:
      // its flower goes to the note's place on the finished map and waits.
      const off = t.x < 16 || t.x > w - 16 || t.y < 16 || t.y > h - 16;
      this.donors[i] = { note: i, flower: best, launch: launchOf(best), bow: (r() - 0.5) * 0.5, rest: off, nudge: { x: 0, y: 0 } };
    }
    // The cloth is spread over the whole stage but the camera is zoomed in on the question, so
    // the notes' own flowers all sit on one side. Each note takes a couple more, the ones nearest
    // where it ends up on the finished map, so the cloth everywhere leaves for the notes.
    const more = w < 600 ? 1 : 2;
    for (let n = 0; n < more; n++) {
      for (const i of order) {
        const t = this.toScreen(data.points[i], this.near);
        const f = nearest(Math.min(w, Math.max(0, t.x)), Math.min(h, Math.max(0, t.y)));
        if (f < 0) continue;
        taken.add(f);
        const ang = r() * TAU;
        this.extras.push({
          note: i,
          flower: f,
          launch: launchOf(f),
          bow: (r() - 0.5) * 0.5,
          rest: true,
          nudge: { x: Math.cos(ang) * 6, y: Math.sin(ang) * 6 },
        });
      }
    }
  }

  private reachOf(i: number, q: Point) {
    const p = this.data.points[i];
    return Math.hypot(p.x - q.x, p.y - q.y);
  }

  /** Where the query dot sits before the camera pulls back, in canvas pixels. */
  queryScreen(): Point {
    return this.toScreen(this.data.query, this.far);
  }

  /** Where the query dot rests once the camera has pulled back, in canvas pixels. */
  queryFinal(): Point {
    return this.toScreen(this.data.query, this.near);
  }

  /** Screen position of a note, for the tooltip. */
  pointScreen(index: number): Point {
    return this.toScreen(this.data.points[index], this.camera());
  }

  /** Nearest note within reach of the pointer, -1 if none. Only once the map is fully drawn. */
  pick(x: number, y: number, radius = 14): number {
    if (this.state.alpha < 0.9) return -1;
    const cam = this.camera();
    let best = -1;
    let bestD = radius;
    this.data.points.forEach((p, i) => {
      const s = this.toScreen(p, cam);
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bestD) {
        best = i;
        bestD = d;
      }
    });
    return best;
  }

  draw(time = 0) {
    const { ctx, state, data, colors, hand } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    if (state.alpha <= 0 && state.query <= 0 && state.gather <= 0) return;

    const cam = this.camera();
    const q = data.query;
    const qs = this.toScreen(q, cam);
    const radius = state.bloom * (this.reach + 0.3);
    const seen = (p: Point) => state.alpha * clamp01((radius - Math.hypot(p.x - q.x, p.y - q.y)) / 0.3);

    // The ground: faint truntum flowers, eight wax dots round a centre, drawn out with the bloom.
    const petal = Math.min(9, Math.max(3.2, cam.s * 0.024));
    const grain = Math.max(0.7, petal * 0.13);
    ctx.fillStyle = rgba(colors.mori, 0.13);
    ctx.beginPath();
    for (const f of this.ground) {
      const a = seen(f);
      if (a <= 0.35) continue;
      const s = this.toScreen(f, cam);
      if (s.x < -20 || s.y < -20 || s.x > this.w + 20 || s.y > this.h + 20) continue;
      if (f.loose) {
        ctx.moveTo(s.x + grain, s.y);
        ctx.arc(s.x, s.y, grain, 0, TAU);
        continue;
      }
      const rr = petal * f.size;
      ctx.moveTo(s.x + grain * 1.3, s.y);
      ctx.arc(s.x, s.y, grain * 1.3, 0, TAU);
      for (let k = 0; k < 8; k++) {
        const ang = f.turn + (k * TAU) / 8;
        const d = k % 2 ? rr * 0.72 : rr;
        const px = s.x + Math.cos(ang) * d;
        const py = s.y + Math.sin(ang) * d;
        ctx.moveTo(px + grain, py);
        ctx.arc(px, py, grain, 0, TAU);
      }
    }
    ctx.fill();

    const hitScreens = this.hitIndex.map((i) => this.toScreen(data.points[i], cam));
    this.drawLabels(cam, seen);

    // Every note, a wax dot each, none quite the same size. A note's dot is there once the
    // flower of cloth it took has flown in and shrunk to it.
    data.points.forEach((p, i) => {
      const a = this.arrival(i, cam);
      if (a <= 0) return;
      const s = this.toScreen(p, cam);
      const hot = i === this.highlight;
      ctx.beginPath();
      ctx.arc(s.x, s.y, hot ? 4.5 : 2.9 * hand.dots[i], 0, TAU);
      ctx.fillStyle = rgba(colors.mori, (hot ? 1 : 0.66) * a);
      ctx.fill();
      if (hot) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, 8.5, 0, TAU);
        ctx.strokeStyle = rgba(colors.mori, 0.7);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
    this.drawFlowers(cam);

    // Canting lines out to the retrieved notes: a row of turmeric wax dots on a slight bow,
    // with a hot tip while it's drawing. Each note gets a wax-resist ring and its rank.
    state.hits.forEach((hit, rank) => {
      if (hit.v <= 0) return;
      const p = hitScreens[rank];
      const t = ease(clamp01(hit.v));
      const dx = p.x - qs.x;
      const dy = p.y - qs.y;
      const len = Math.hypot(dx, dy) || 1;
      const bow = hand.bows[rank] * len;
      const mx = qs.x + dx / 2 - (dy / len) * bow;
      const my = qs.y + dy / 2 + (dx / len) * bow;
      const at = (u: number) => {
        const v = 1 - u;
        return { x: v * v * qs.x + 2 * v * u * mx + u * u * p.x, y: v * v * qs.y + 2 * v * u * my + u * u * p.y };
      };
      const n = Math.max(2, Math.floor(len / DOT_GAP));
      ctx.fillStyle = rgba(colors.kunyit, 0.9);
      ctx.beginPath();
      // Skip the first dots, under the query's own glow.
      for (let k = 2; k <= n * t; k++) {
        const d = at(k / n);
        const rad = 1.15 + hand.grains[(k + rank * 13) % hand.grains.length] * 0.55;
        ctx.moveTo(d.x + rad, d.y);
        ctx.arc(d.x, d.y, rad, 0, TAU);
      }
      ctx.fill();

      if (hit.v < 1) {
        const tip = at(t);
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 2.6, 0, TAU);
        ctx.fillStyle = rgba(colors.kunyit, 1);
        ctx.fill();
        return;
      }

      const hot = this.hitIndex[rank] === this.highlight;
      const ring = hot ? 11 : 9;
      const wobble = hand.rings[rank];
      // The wax ring: a hand-drawn circle left undyed, a dyed centre, and a ring of cecek.
      ctx.beginPath();
      for (let k = 0; k <= wobble.length; k++) {
        const ang = (k / wobble.length) * TAU;
        const rr = ring + wobble[k % wobble.length] * 0.7;
        const x = p.x + Math.cos(ang) * rr;
        const y = p.y + Math.sin(ang) * rr;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = rgba(colors.mori, hot ? 1 : 0.85);
      ctx.lineWidth = 1.6;
      ctx.lineJoin = "round";
      ctx.stroke();

      ctx.fillStyle = rgba(colors.kunyit, 1);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.6, 0, TAU);
      for (let k = 0; k < 10; k++) {
        const ang = (k / 10) * TAU + rank;
        const x = p.x + Math.cos(ang) * (ring + 5);
        const y = p.y + Math.sin(ang) * (ring + 5);
        ctx.moveTo(x + 1, y);
        ctx.arc(x, y, 1, 0, TAU);
      }
      ctx.fill();

      ctx.font = `500 11px ${this.font}`;
      ctx.textAlign = "left";
      ctx.fillText(String(rank + 1), p.x + ring + 7, p.y - ring - 3);
    });

    // The query: a warm glow, the dot, a thin wax ring, and a ring that keeps pinging once it's in place.
    if (state.query > 0 && state.exit < 1) {
      const r = 5.5;
      const glow = ctx.createRadialGradient(qs.x, qs.y, 0, qs.x, qs.y, r * 5);
      glow.addColorStop(0, rgba(colors.kunyit, 0.5 * state.query));
      glow.addColorStop(0.35, rgba(colors.kunyit, 0.2 * state.query));
      glow.addColorStop(1, rgba(colors.kunyit, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(qs.x - r * 5, qs.y - r * 5, r * 10, r * 10);

      ctx.beginPath();
      ctx.arc(qs.x, qs.y, r, 0, TAU);
      ctx.fillStyle = rgba(colors.kunyit, state.query);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(qs.x, qs.y, r + 4, 0, TAU);
      ctx.strokeStyle = rgba(colors.mori, 0.45 * state.query);
      ctx.lineWidth = 1;
      ctx.stroke();

      if (time > 0 && state.query >= 1) {
        const f = (time % 1800) / 1800;
        ctx.beginPath();
        ctx.arc(qs.x, qs.y, r + 6 + f * 26, 0, TAU);
        ctx.strokeStyle = rgba(colors.kunyit, 0.5 * (1 - f));
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  /** 0 to 1: how far a cloth flower's flight has got. */
  private flightOf(d: Donor | undefined) {
    if (!d) return this.state.gather >= 1 ? 1 : 0;
    return clamp01((this.state.gather - d.launch) / FLIGHT);
  }

  private flight(i: number) {
    return this.flightOf(this.donors[i]);
  }

  /** How much of a note's dot has appeared: it comes in as the flower lands. */
  private arrival(i: number, cam: Camera) {
    const landed = clamp01((this.flight(i) - 0.7) / 0.3);
    return this.donors[i]?.rest ? Math.min(landed, this.handover(i, cam)) : landed;
  }

  /**
   * 0 to 1: how near a note's live dot has come to its place on the finished map. A flower
   * waiting there gives way to the dot as the camera brings it in.
   */
  private handover(i: number, cam: Camera) {
    const p = this.data.points[i];
    const live = this.toScreen(p, cam);
    const rest = this.toScreen(p, this.near);
    return clamp01(1 - Math.hypot(live.x - rest.x, live.y - rest.y) / 24);
  }

  /**
   * The cloth's flowers in the air: each one leaves where the iris passes it, flies to the spot
   * its note is at right now, and shrinks into the wax dot. The dye is shaded by how near the note
   * is to the question. The five closest don't shrink all the way: they stay open as a small
   * turmeric flower until the canting line reaches them.
   */
  private drawFlowers(cam: Camera) {
    const { state, cloth } = this;
    if (!cloth || state.gather <= 0) return;
    this.ctx.lineWidth = Math.max(0.6, (cloth.petals[0]?.a ?? 10) * 0.06);
    for (const d of this.extras) this.drawFlower(d, cam, false);
    for (const d of this.donors) if (d) this.drawFlower(d, cam, true);
    this.ctx.globalAlpha = 1;
  }

  private drawFlower(d: Donor, cam: Camera, main: boolean) {
    const { ctx, state, cloth, colors, data, w, h } = this;
    if (!cloth) return;
    const rank = main ? this.hitIndex.indexOf(d.note) : -1;
    const top = rank >= 0;
    const u = this.flightOf(d);
    const hand = d.rest ? this.handover(d.note, cam) : 0;
    if (u <= 0 || (!top && (d.rest ? hand >= 1 : u >= 1))) return;
    const left = top ? 1 - clamp01(state.hits[rank].v) : 1;
    if (left <= 0) return;
    const e = ease(u);
    const from = cloth.seeds[d.flower];
    // A flower whose note is on the stage follows the note's live dot. The rest, and every spare
    // flower, fly to the note's place on the finished map and wait there as a small flower.
    let to: Point;
    if (d.rest) {
      const at = this.toScreen(data.points[d.note], this.near);
      to = { x: at.x + d.nudge.x, y: at.y + d.nudge.y };
    } else {
      const at = this.toScreen(data.points[d.note], cam);
      to = { x: Math.min(w - 16, Math.max(16, at.x)), y: Math.min(h - 16, Math.max(16, at.y)) };
    }
    const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const arc = Math.sin(Math.PI * e) * d.bow * len;
    const cx = from.x + (to.x - from.x) * e - ((to.y - from.y) / len) * arc;
    const cy = from.y + (to.y - from.y) * e + ((to.x - from.x) / len) * arc;
    // Shrinks to a small flower, a note near the question keeping a bigger one.
    const rest = top ? 0.4 : 0.16;
    const k = 1 + (rest - 1) * e ** 0.7;
    const fade = top ? left : d.rest ? 1 - hand : 1 - clamp01((u - 0.72) / 0.28);
    // The shading comes in over the flight, so a flower leaving the cloth doesn't dim in one frame.
    const shade = 1 + (0.3 + 0.7 * clamp01(this.close[d.note] * 1.6) - 1) * e;
    const dye = shade * fade;
    for (let q = 0; q < 4; q++) {
      const pt = cloth.petals[d.flower * 4 + q];
      const px = cx + (pt.x - from.x) * k;
      const py = cy + (pt.y - from.y) * k;
      if (pt.size >= 0) {
        ctx.globalAlpha = 0.92 * dye;
        ctx.fillStyle = rgba(pt.positive || top ? colors.kunyit : colors.soga, 1);
        const dk = dyeScale(pt.size);
        ctx.beginPath();
        ctx.ellipse(px, py, pt.a * k * dk, pt.b * k * dk, pt.angle + pt.tilt, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 0.4 * fade;
      ctx.strokeStyle = rgba(colors.mori, 1);
      ctx.beginPath();
      ctx.ellipse(px, py, pt.a * k, pt.b * k, pt.angle, 0, TAU);
      ctx.stroke();
    }
    if (top && e > 0.5) {
      // The seed of the flower: a turmeric dot in a wax ring, so it reads as kawung, not a cross.
      ctx.globalAlpha = fade * clamp01((e - 0.5) / 0.4);
      ctx.beginPath();
      ctx.arc(cx, cy, 3.4, 0, TAU);
      ctx.fillStyle = rgba(colors.kunyit, 1);
      ctx.fill();
      ctx.strokeStyle = rgba(colors.mori, 1);
      ctx.stroke();
    }
  }

  /**
   * The group names, in the mono face, each put where nothing is. Placed once per resize against
   * the finished map: it tries spots round the group's centre, nearest first, and takes the first
   * that clears every dot, the query, the rings and numbers on the retrieved notes, the canting
   * lines out to them (at their full length), the other labels, the header and the canvas edge,
   * and that sits next to its own group's notes. The offset is kept in map units, so the labels
   * ride the camera as it pulls back and never hop. One that can't find a clear spot is left out:
   * the notes matter more.
   */
  private layLabels() {
    const { ctx, data, w, h, region } = this;
    this.labels = [];
    ctx.font = `400 10.5px ${this.font}`;
    ctx.letterSpacing = "0.04em";
    const cam = this.near;
    const qs = this.toScreen(data.query, cam);
    const root = getComputedStyle(document.documentElement);
    const raw = root.getPropertyValue("--header-h").trim();
    const header = (parseFloat(raw) || 0) * (raw.endsWith("rem") ? parseFloat(root.fontSize) || 16 : 1);
    const top = header + 12;

    type Disc = Point & { r: number };
    const dots = data.points.map((p) => this.toScreen(p, cam));
    const discs: Disc[] = dots.map((p) => ({ ...p, r: 5 }));
    discs.push({ x: qs.x, y: qs.y, r: 17 });
    this.hitIndex.forEach((idx, rank) => {
      const p = dots[idx];
      discs.push({ x: p.x, y: p.y, r: 17 });
      // The rank's numeral sits up and to the right of the ring.
      discs.push({ x: p.x + 20, y: p.y - 16, r: 7 });
      // The line out to it, as a row of points along its bow.
      const dx = p.x - qs.x;
      const dy = p.y - qs.y;
      const len = Math.hypot(dx, dy) || 1;
      const bow = this.hand.bows[rank] * len;
      const mx = qs.x + dx / 2 - (dy / len) * bow;
      const my = qs.y + dy / 2 + (dx / len) * bow;
      const n = Math.max(3, Math.ceil(len / 9));
      for (let k = 1; k < n; k++) {
        const u = k / n;
        const v = 1 - u;
        discs.push({ x: v * v * qs.x + 2 * v * u * mx + u * u * p.x, y: v * v * qs.y + 2 * v * u * my + u * u * p.y, r: 4 });
      }
    });

    const placed: { x: number; y: number; w: number }[] = [];
    const room = (x: number, y: number, bw: number) => {
      const hw = bw / 2;
      if (x - hw < Math.max(8, region.x - 16) || x + hw > Math.min(w - 8, region.x + region.w + 16)) return false;
      if (y < Math.max(top, region.y - 16) || y > Math.min(h - 10, region.y + region.h + 16)) return false;
      for (const d of discs) {
        const ex = Math.max(Math.abs(d.x - x) - hw, 0);
        const ey = Math.max(Math.abs(d.y - y) - 7, 0);
        if (ex * ex + ey * ey < d.r * d.r) return false;
      }
      // Labels that share a column need a clear gap, or two read as one two-line name.
      return !placed.some((p) => Math.abs(p.x - x) < (p.w + bw) / 2 + 4 && Math.abs(p.y - y) < 34);
    };
    // The note nearest a spot should be one of the group's own, so the name stays by its cluster.
    const own = (name: string, x: number, y: number) => {
      let best = -1;
      let bestD = Infinity;
      dots.forEach((p, i) => {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bestD) {
          best = i;
          bestD = d;
        }
      });
      return best >= 0 && data.points[best].group === name;
    };

    for (const g of [...this.groups].sort((a, b) => b.y - a.y)) {
      const bw = ctx.measureText(g.name).width + 10;
      const s = this.toScreen(g, cam);
      const fits = (strict: boolean) => (o: Point) =>
        room(s.x + o.x, s.y + o.y, bw) && (!strict || own(g.name, s.x + o.x, s.y + o.y));
      // Failing a spot by its own cluster, a label may sit a little way off, never far enough to read as another group's.
      const at = SPOTS.find(fits(true)) ?? SPOTS.find((o) => o.r <= 50 && fits(false)(o));
      if (!at) continue;
      placed.push({ x: s.x + at.x, y: s.y + at.y, w: bw });
      this.labels.push({ name: g.name, at: g, off: { x: at.x / cam.s, y: at.y / cam.s }, w: bw });
    }
    ctx.letterSpacing = "0px";
  }

  private drawLabels(cam: Camera, seen: (p: Point) => number) {
    const { ctx, colors } = this;
    ctx.font = `400 10.5px ${this.font}`;
    ctx.letterSpacing = "0.04em";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    for (const l of this.labels) {
      const a = seen(l.at);
      if (a <= 0) continue;
      const s = this.toScreen(l.at, cam);
      const x = s.x + l.off.x * cam.s;
      // Mid pull-back a name can reach past the canvas: leave it out until it's whole.
      if (x - l.w / 2 < 0 || x + l.w / 2 > this.w) continue;
      ctx.fillStyle = rgba(colors.pudar, 0.85 * a);
      ctx.fillText(l.name, x, s.y + l.off.y * cam.s);
    }
    ctx.letterSpacing = "0px";
  }

  private camera(): Camera {
    const t = ease(clamp01(this.state.cam));
    const { far, near } = this;
    return {
      cx: far.cx + (near.cx - far.cx) * t,
      cy: far.cy + (near.cy - far.cy) * t,
      s: far.s + (near.s - far.s) * t,
    };
  }

  private toScreen(p: Point, cam: Camera): Point {
    return { x: cam.cx + p.x * cam.s, y: cam.cy - p.y * cam.s };
  }

  private fit(r: Region): Camera {
    const { minX, maxX, minY, maxY } = this.bounds;
    const s = Math.min(r.w / (maxX - minX), r.h / (maxY - minY));
    return {
      cx: r.x + r.w / 2 - ((minX + maxX) / 2) * s,
      cy: r.y + r.h / 2 + ((minY + maxY) / 2) * s,
      s,
    };
  }
}
