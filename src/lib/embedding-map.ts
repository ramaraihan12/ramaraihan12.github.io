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
  /** One per retrieved note, draws the line out to it. */
  hits: { v: number }[];
};

/** The ground's grid, in PCA units. A truntum flower sits on every point of it. */
const GRID = 0.25;
/** Space between the wax dots of a hit line, in pixels. */
const DOT_GAP = 6;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const TAU = Math.PI * 2;

/** One flower of the truntum ground: where it sits, how it's turned and how big. */
type Flower = Point & { turn: number; size: number; loose: boolean };

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
  private colors = { mori: cssColor("--mori"), pudar: cssColor("--pudar"), kunyit: cssColor("--kunyit") };
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
      hits: data.top.map(() => ({ v: 0 })),
    };

    const q = data.query;
    this.reach = Math.max(...data.points.map((p) => Math.hypot(p.x - q.x, p.y - q.y)));

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
    Object.assign(this.state, { bloom: 1, alpha: 1, query: 1, cam: 1 });
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
    this.near = this.fit(region);
    // Zoomed in around the query, which sits at the anchor until the camera pulls back.
    const q = this.data.query;
    const at = anchor ?? this.toScreen(q, this.near);
    const s = this.near.s * this.zoom;
    this.far = { cx: at.x - q.x * s, cy: at.y + q.y * s, s };
  }

  /** Where the query dot sits before the camera pulls back, in canvas pixels. */
  queryScreen(): Point {
    return this.toScreen(this.data.query, this.far);
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
    if (state.alpha <= 0 && state.query <= 0) return;

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

    // Where the query and the retrieved notes are, so the group labels can keep clear of them.
    const hitScreens = this.hitIndex.map((i) => this.toScreen(data.points[i], cam));
    const keepClear = [{ x: qs.x, y: qs.y, r: 16 }, ...hitScreens.map((p) => ({ x: p.x, y: p.y, r: 18 }))];

    // Group labels, in the mono face, nudged apart from each other and off the query and hits.
    // One that can't find a clear spot nearby is left out; the notes matter more than their labels.
    ctx.font = `400 10.5px ${this.font}`;
    ctx.letterSpacing = "0.04em";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const placed: { x: number; y: number; w: number }[] = [];
    const hits = (x: number, y: number, w: number) =>
      placed.some((p) => Math.abs(p.x - x) < (p.w + w) / 2 && Math.abs(p.y - y) < 15) ||
      keepClear.some((c) => Math.abs(c.x - x) < w / 2 + c.r && Math.abs(c.y - y) < 7 + c.r);
    for (const g of [...this.groups].sort((a, b) => b.y - a.y)) {
      const a = seen(g);
      if (a <= 0) continue;
      const s = this.toScreen(g, cam);
      const w = ctx.measureText(g.name).width + 10;
      const dy = [-18, 18, -34, 34].find((d) => !hits(s.x, s.y + d, w));
      if (dy === undefined) continue;
      const y = s.y + dy;
      placed.push({ x: s.x, y, w });
      ctx.fillStyle = rgba(colors.pudar, 0.85 * a);
      ctx.fillText(g.name, s.x, y);
    }
    ctx.letterSpacing = "0px";

    // Every note, a wax dot each, none quite the same size.
    data.points.forEach((p, i) => {
      const a = seen(p);
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
    if (state.query > 0) {
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
