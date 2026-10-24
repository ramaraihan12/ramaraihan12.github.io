import type retrievalData from "@/content/retrieval.json";
import { cssColor, rgba } from "./tokens";

type Retrieval = typeof retrievalData;
type Point = { x: number; y: number };
type Camera = { cx: number; cy: number; s: number };
export type Region = { x: number; y: number; w: number; h: number };

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

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Draws the notes as dots in the 2D projection from scripts/embed_notes.py, the question as a
 * turmeric dot, and lines out to the retrieved notes. The canvas only paints; the scene owns
 * the timeline and calls draw() every frame while it's on screen.
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

  constructor(
    private canvas: HTMLCanvasElement,
    private data: Retrieval,
    private region: (w: number, h: number) => Region,
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

    this.near = this.fit(this.region(this.w, this.h));
    // Zoomed in around the query, which stays put on screen while the camera pulls back.
    const q = this.data.query;
    const s = this.near.s * this.zoom;
    const qx = this.near.cx + q.x * this.near.s;
    const qy = this.near.cy - q.y * this.near.s;
    this.far = { cx: qx - q.x * s, cy: qy + q.y * s, s };
  }

  /** Where the query dot sits, in canvas pixels. */
  queryScreen(): Point {
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
    const { ctx, state, data, colors } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    if (state.alpha <= 0 && state.query <= 0) return;

    const cam = this.camera();
    const q = data.query;
    const qs = this.toScreen(q, cam);
    const radius = state.bloom * (this.reach + 0.3);
    const seen = (p: Point) => state.alpha * clamp01((radius - Math.hypot(p.x - q.x, p.y - q.y)) / 0.3);

    // Faint plus marks every quarter unit, so the space reads as a plot and not a starfield.
    ctx.strokeStyle = rgba(colors.pudar, 0.18);
    ctx.lineWidth = 1;
    ctx.beginPath();
    const { minX, maxX, minY, maxY } = this.bounds;
    for (let gx = Math.ceil(minX * 4) / 4; gx <= maxX; gx += 0.25) {
      for (let gy = Math.ceil(minY * 4) / 4; gy <= maxY; gy += 0.25) {
        if (seen({ x: gx, y: gy }) <= 0.5) continue;
        const s = this.toScreen({ x: gx, y: gy }, cam);
        ctx.moveTo(s.x - 3, s.y);
        ctx.lineTo(s.x + 3, s.y);
        ctx.moveTo(s.x, s.y - 3);
        ctx.lineTo(s.x, s.y + 3);
      }
    }
    ctx.stroke();

    // Group labels, nudged apart when two land on top of each other.
    ctx.font = `400 11px ${this.font}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const placed: { x: number; y: number; w: number }[] = [];
    for (const g of [...this.groups].sort((a, b) => b.y - a.y)) {
      const a = seen(g);
      if (a <= 0) continue;
      const s = this.toScreen(g, cam);
      const w = ctx.measureText(g.name).width + 12;
      let y = s.y - 18;
      for (const p of placed) {
        if (Math.abs(p.x - s.x) < (p.w + w) / 2 && Math.abs(p.y - y) < 16) y = p.y + 16;
      }
      placed.push({ x: s.x, y, w });
      ctx.fillStyle = rgba(colors.pudar, 0.75 * a);
      ctx.fillText(g.name, s.x, y);
    }

    // Every note.
    data.points.forEach((p, i) => {
      const a = seen(p);
      if (a <= 0) return;
      const s = this.toScreen(p, cam);
      const hot = i === this.highlight;
      ctx.beginPath();
      ctx.arc(s.x, s.y, hot ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = rgba(colors.mori, (hot ? 1 : 0.62) * a);
      ctx.fill();
    });

    // Lines out to the retrieved notes, then the notes themselves with their rank.
    state.hits.forEach((hit, rank) => {
      if (hit.v <= 0) return;
      const p = this.toScreen(data.points[this.hitIndex[rank]], cam);
      const t = ease(clamp01(hit.v));
      ctx.beginPath();
      ctx.moveTo(qs.x, qs.y);
      ctx.lineTo(qs.x + (p.x - qs.x) * t, qs.y + (p.y - qs.y) * t);
      ctx.strokeStyle = rgba(colors.kunyit, 0.75);
      ctx.lineWidth = 1.25;
      ctx.stroke();

      if (hit.v >= 1) {
        const hot = this.hitIndex[rank] === this.highlight;
        ctx.beginPath();
        ctx.arc(p.x, p.y, hot ? 8 : 6, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(colors.kunyit, 1);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.font = `500 11px ${this.font}`;
        ctx.textAlign = "left";
        ctx.fillStyle = rgba(colors.kunyit, 1);
        ctx.fillText(String(rank + 1), p.x + 11, p.y - 9);
      }
    });

    // The query: a soft glow, the dot, and a ring that keeps pinging once it's in place.
    if (state.query > 0) {
      const r = 5.5 * state.query;
      const glow = ctx.createRadialGradient(qs.x, qs.y, 0, qs.x, qs.y, r * 6);
      glow.addColorStop(0, rgba(colors.kunyit, 0.35 * state.query));
      glow.addColorStop(1, rgba(colors.kunyit, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(qs.x - r * 6, qs.y - r * 6, r * 12, r * 12);

      ctx.beginPath();
      ctx.arc(qs.x, qs.y, r, 0, Math.PI * 2);
      ctx.fillStyle = rgba(colors.kunyit, 1);
      ctx.fill();

      if (time > 0 && state.query >= 1) {
        const f = (time % 1800) / 1800;
        ctx.beginPath();
        ctx.arc(qs.x, qs.y, r + 4 + f * 26, 0, Math.PI * 2);
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
