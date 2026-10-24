"use client";

import { type CSSProperties, type Ref, useEffect, useImperativeHandle, useRef } from "react";
import { hash, rng } from "./rng";

/*
  An embedding drawn as a kawung cloth. Every value in the vector is one petal: four values make
  a flower, and the flowers sit on the kawung grid, petals running from each centre to the
  corners. The size of the dye inside a petal is how big the value is, its tilt follows the
  value, and the sign picks the dye: kunyit for positive, soga for negative. The thin mori
  outline is the wax drawing, the same for every petal.

  progress (0 to 1) draws it in like a canting, outward from `origin`: each petal's outline is
  traced with a hot turmeric tip, then the dye fills in.
*/

export type KawungFieldHandle = {
  /** Draw at a progress from 0 to 1. Cheap to call every frame from a scroll timeline. */
  draw: (progress: number) => void;
};

export type KawungFieldProps = {
  /** The vector, e.g. retrieval.queryVector (1024 floats around ±0.2). */
  values: readonly number[];
  /** 0 to 1. Default 1, fully drawn. */
  progress?: number;
  /** Flowers per row. By default the grid follows the box's aspect ratio. */
  columns?: number;
  /** Where the canting starts, as fractions of the box. Default the centre. */
  origin?: { x: number; y: number };
  /**
   * Inks. Default: --kunyit for positive, --soga-2 (or --soga) for negative, --mori for the wax
   * line, read from CSS when the canvas is measured. Pass literal colors for other grounds.
   */
  inks?: { positive?: string; negative?: string; line?: string };
  className?: string;
  style?: CSSProperties;
  ref?: Ref<KawungFieldHandle>;
};

type Petal = {
  x: number;
  y: number;
  /** Full-size semi-axes, along and across. */
  a: number;
  b: number;
  angle: number;
  /** 0 to 1, how much dye. -1 for a slot past the end of the vector: wax only. */
  size: number;
  tilt: number;
  positive: boolean;
  /** When the canting reaches this petal, 0 to 1. */
  at: number;
};

type Layout = {
  petals: Petal[];
  seeds: { x: number; y: number }[];
  dot: number;
};

/** How much of the timeline one petal takes to draw. */
const SPAN = 0.16;

const ease = (t: number) => 1 - (1 - t) ** 3;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function readColor(el: Element, name: string, fallback: string) {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

function layout(values: readonly number[], w: number, h: number, columns: number | undefined, origin: { x: number; y: number }): Layout {
  const needed = Math.max(1, Math.ceil(values.length / 4));
  const ideal = columns ?? Math.max(1, Math.round(Math.sqrt((needed * w) / Math.max(1, h))));
  const cell = Math.min(w / ideal, h / Math.ceil(needed / ideal));
  // The cloth covers the whole box: slots past the end of the vector are wax only, no dye.
  const cols = columns ?? Math.max(ideal, Math.floor(w / cell + 1e-6));
  const rows = Math.max(Math.ceil(needed / cols), Math.floor(h / cell + 1e-6));
  const flowers = cols * rows;
  const x0 = (w - cell * cols) / 2;
  const y0 = (h - cell * rows) / 2;

  // Scale by a high percentile, so one spike doesn't shrink everything else.
  const mags = values.map(Math.abs).sort((p, q) => p - q);
  const top = mags[Math.floor(mags.length * 0.98)] || mags[mags.length - 1] || 1;

  const half = (cell * Math.SQRT2) / 4;
  const a = half * 0.86;
  const b = a * 0.62;
  const ox = origin.x * w;
  const oy = origin.y * h;
  const reach = Math.max(Math.hypot(ox, oy), Math.hypot(w - ox, oy), Math.hypot(ox, h - oy), Math.hypot(w - ox, h - oy)) || 1;
  const r = rng(hash(`${values.length}:${cols}`));

  const petals: Petal[] = [];
  const seeds: { x: number; y: number }[] = [];
  for (let f = 0; f < flowers; f++) {
    const cx = x0 + (f % cols) * cell + cell / 2;
    const cy = y0 + Math.floor(f / cols) * cell + cell / 2;
    seeds.push({ x: cx, y: cy });
    const start = (Math.hypot(cx - ox, cy - oy) / reach) * 0.85 + r() * 0.05;
    for (let q = 0; q < 4; q++) {
      const v = values[f * 4 + q];
      const angle = Math.PI / 4 + (q * Math.PI) / 2;
      const s = v === undefined ? -1 : clamp01(Math.abs(v) / top);
      petals.push({
        x: cx + Math.cos(angle) * half,
        y: cy + Math.sin(angle) * half,
        a,
        b,
        angle,
        size: s,
        tilt: v === undefined ? 0 : (v / top) * 0.22,
        positive: (v ?? 0) >= 0,
        at: start + q * 0.02,
      });
    }
  }
  // The corners of the grid are flower centres too.
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) seeds.push({ x: x0 + i * cell, y: y0 + j * cell });
  return { petals, seeds, dot: Math.max(0.8, cell * 0.035) };
}

/**
 * A 1024-float embedding as a kawung field on a canvas. Decorative, so it's aria-hidden; put
 * the meaning in nearby text. Fills its box: give the canvas (or a wrapper) a size.
 */
export function KawungField({
  values,
  progress = 1,
  columns,
  origin = { x: 0.5, y: 0.5 },
  inks,
  className,
  style,
  ref,
}: KawungFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef({
    layout: null as Layout | null,
    dpr: 1,
    w: 0,
    h: 0,
    drawn: -1,
    progress,
    colors: { positive: "#f4b223", negative: "#8a5a2b", line: "#efe9dc" },
  });
  const ox = origin.x;
  const oy = origin.y;
  const inkPositive = inks?.positive;
  const inkNegative = inks?.negative;
  const inkLine = inks?.line;

  const paint = (p: number) => {
    const canvas = canvasRef.current;
    const s = state.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !s.layout) return;
    s.drawn = p;
    const { petals, seeds, dot } = s.layout;
    const { positive, negative, line } = s.colors;

    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.clearRect(0, 0, s.w, s.h);
    const lineWidth = Math.max(0.6, petals[0]?.a * 0.06 || 1);
    const tips: [number, number][] = [];

    for (const pt of petals) {
      const t = clamp01((p - pt.at * (1 - SPAN)) / SPAN);
      if (t <= 0) continue;
      const trace = ease(clamp01(t / 0.6));
      const dye = ease(clamp01((t - 0.45) / 0.55));

      // Magnitude is the size of the dye, not its strength, so the colors stay clean.
      if (dye > 0 && pt.size >= 0) {
        ctx.globalAlpha = dye * 0.92;
        ctx.fillStyle = pt.positive ? positive : negative;
        const k = 0.2 + 0.72 * Math.sqrt(pt.size);
        ctx.beginPath();
        ctx.ellipse(pt.x, pt.y, pt.a * k, pt.b * k, pt.angle + pt.tilt, 0, Math.PI * 2);
        ctx.fill();
      }

      // The wax outline, traced from the inner tip round.
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = line;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      const start = Math.PI;
      ctx.ellipse(pt.x, pt.y, pt.a, pt.b, pt.angle, start, start + Math.PI * 2 * trace);
      ctx.stroke();
      if (trace < 1) {
        const e = start + Math.PI * 2 * trace;
        const cos = Math.cos(pt.angle);
        const sin = Math.sin(pt.angle);
        const ex = pt.a * Math.cos(e);
        const ey = pt.b * Math.sin(e);
        tips.push([pt.x + ex * cos - ey * sin, pt.y + ex * sin + ey * cos]);
      }
    }

    // Seed dots where petals meet, once the drawing has begun around them.
    ctx.globalAlpha = 0.55 * clamp01(p * 4);
    ctx.fillStyle = line;
    ctx.beginPath();
    for (const sd of seeds) {
      ctx.moveTo(sd.x + dot, sd.y);
      ctx.arc(sd.x, sd.y, dot, 0, Math.PI * 2);
    }
    ctx.fill();

    // The canting's hot tips.
    if (tips.length) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = positive;
      ctx.beginPath();
      const rad = lineWidth * 1.4;
      for (const [x, y] of tips) {
        ctx.moveTo(x + rad, y);
        ctx.arc(x, y, rad, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  // Keep the latest paint in a ref so the imperative handle and the observer always see it.
  const paintRef = useRef(paint);
  useEffect(() => {
    paintRef.current = paint;
  });

  useImperativeHandle(
    ref,
    () => ({
      draw: (p: number) => {
        const v = clamp01(p);
        state.current.progress = v;
        if (v !== state.current.drawn) paintRef.current(v);
      },
    }),
    [],
  );

  // Size, layout and colors: on mount, on resize, and when the data changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = state.current;
    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      s.w = rect.width;
      s.h = rect.height;
      s.dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(s.w * s.dpr);
      canvas.height = Math.round(s.h * s.dpr);
      s.colors = {
        positive: inkPositive ?? readColor(canvas, "--kunyit", "#f4b223"),
        negative: inkNegative ?? readColor(canvas, "--soga-2", readColor(canvas, "--soga", "#b5824a")),
        line: inkLine ?? readColor(canvas, "--mori", "#efe9dc"),
      };
      s.layout = layout(values, s.w, s.h, columns, { x: ox, y: oy });
      paintRef.current(s.progress);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [values, columns, ox, oy, inkPositive, inkNegative, inkLine]);

  // Redraw only when progress actually changes.
  useEffect(() => {
    const v = clamp01(progress);
    state.current.progress = v;
    if (v !== state.current.drawn) paintRef.current(v);
  }, [progress]);

  return (
    <canvas
      ref={canvasRef}
      className={className ? `art-kawung-field ${className}` : "art-kawung-field"}
      aria-hidden="true"
      style={{ display: "block", width: "100%", height: "100%", ...style }}
    />
  );
}
