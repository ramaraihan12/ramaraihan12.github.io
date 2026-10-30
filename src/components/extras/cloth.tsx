"use client";

import Link from "next/link";
import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { rng, wobble } from "@/components/art/rng";
import { notFoundCopy as T } from "@/content/copy";

/*
  The 404 page: a blank cloth. Draw on it with the pointer and that's wax; press Dip and the cloth
  goes nila from the bottom up, except under the wax, which stays the colour of the cotton. That's
  how batik is made (malam keeps the dye out), so a wrong address ends up with a small lesson in it.

  One canvas. Strokes are kept as points in screen pixels, so a resize or the dye can draw them
  again. Wax is drawn opaque, which lets the newest stroke be drawn over itself while the pointer
  moves. The dye is a fill clipped below a wavy front that rises with the animation: first every
  stroke in wax colours, then the dye over them, then the strokes again in cotton colour inside
  the dye. Only the dip animates, and only that one frame loop runs. With reduced motion the
  front jumps to the top and the kawung appears at once.

  Styles are in src/styles/extras.css (.nf-*).
*/

type Pt = readonly [number, number];

const COLORS = {
  cotton: "#efe9dc",
  dye: "#0f1a47",
  /** Wax on cotton: a pale brown skin with a darker core, like malam going on warm. */
  waxSkin: "#d8bf99",
  waxCore: "#b88c58",
};
const BRUSH = 9;
const DIP_MS = 1500;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const MAX_PATH = 44;

/** A line through the points, smoothed by curving to the middle of each segment. */
function trace(ctx: CanvasRenderingContext2D, pts: readonly Pt[], closed = false) {
  ctx.beginPath();
  if (pts.length === 1) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.lineTo(pts[0][0] + 0.01, pts[0][1]);
    return;
  }
  if (closed) {
    const n = pts.length;
    const mid = (i: number): Pt => {
      const a = pts[i % n];
      const b = pts[(i + 1) % n];
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    };
    const start = mid(n - 1);
    ctx.moveTo(start[0], start[1]);
    for (let i = 0; i < n; i++) {
      const m = mid(i);
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
    }
    ctx.closePath();
    return;
  }
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0], last[1]);
}

type Stroke = { pts: Pt[]; closed: boolean };

function waxOn(ctx: CanvasRenderingContext2D, s: Stroke) {
  trace(ctx, s.pts, s.closed);
  ctx.lineWidth = BRUSH;
  ctx.strokeStyle = COLORS.waxSkin;
  ctx.stroke();
  ctx.lineWidth = BRUSH * 0.42;
  ctx.strokeStyle = COLORS.waxCore;
  ctx.stroke();
}

function resist(ctx: CanvasRenderingContext2D, s: Stroke) {
  trace(ctx, s.pts, s.closed);
  ctx.lineWidth = BRUSH;
  ctx.strokeStyle = COLORS.cotton;
  ctx.stroke();
}

/** Where the dye's edge is at x, for a rise of p from 0 to 1. Wavy, like cloth lowered by hand. */
function front(x: number, p: number, h: number) {
  const amp = 16;
  return h - p * (h + amp * 2) + Math.sin(x / 63 + p * 7) * amp * Math.min(1, p * 6) * Math.min(1, (1 - p) * 6 + 0.001);
}

/**
 * A patch of kawung in wax: flowers on a square lattice, every other point, each with four
 * petals that run from the centre toward its corners, the same construction as the batik tiles.
 * Drawn from the middle outward, petals first.
 */
function kawungStrokes(w: number, h: number): Stroke[] {
  const r = rng(404);
  const s = Math.max(66, Math.min(112, Math.min(w, h) / 5.5));
  const cx = w > 900 ? w * 0.64 : w / 2;
  const cy = w > 900 ? h * 0.58 : h * 0.7;
  const half = (s * Math.SQRT2) / 4;
  const a = half * 0.88;
  const b = a * 0.62;
  const flowers: { x: number; y: number; d: number }[] = [];
  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      if ((i + j) % 2 !== 0) continue;
      const d = Math.hypot(i, j);
      if (d > 3) continue;
      flowers.push({ x: cx + i * s, y: cy + j * s, d });
    }
  }
  flowers.sort((p, q) => p.d - q.d);
  const out: Stroke[] = [];
  for (const f of flowers) {
    for (let k = 0; k < 4; k++) {
      const angle = Math.PI / 4 + (k * Math.PI) / 2;
      const px = f.x + Math.cos(angle) * half;
      const py = f.y + Math.sin(angle) * half;
      if (px < -a || px > w + a || py < -a || py > h + a) continue;
      const pts: Pt[] = [];
      const steps = 28;
      for (let n = 0; n < steps; n++) {
        const t = (n / steps) * Math.PI * 2;
        // A slight point at each end of the long axis, like a petal and not an egg.
        const sharp = 1 + 0.18 * Math.abs(Math.cos(t)) ** 6;
        const u = Math.cos(t) * a * sharp;
        const v = Math.sin(t) * b;
        pts.push([
          px + u * Math.cos(angle) - v * Math.sin(angle) + wobble(r, 0.9),
          py + u * Math.sin(angle) + v * Math.cos(angle) + wobble(r, 0.9),
        ]);
      }
      out.push({ pts, closed: true });
    }
    // The dot at the heart.
    const heart: Pt[] = Array.from({ length: 10 }, (_, n) => {
      const t = (n / 10) * Math.PI * 2;
      return [f.x + Math.cos(t) * 3.2 + wobble(r, 0.5), f.y + Math.sin(t) * 3.2 + wobble(r, 0.5)] as const;
    });
    out.push({ pts: heart, closed: true });
  }
  return out;
}

type Phase = "blank" | "waxed" | "dyed";

/** The address as the visitor typed it, short enough to sit in a heading. */
function readPath() {
  let path = location.pathname;
  try {
    path = decodeURI(path);
  } catch {}
  if (path === "/" || !path) return "";
  return path.length > MAX_PATH ? `${path.slice(0, MAX_PATH - 1)}…` : path;
}

export function Cloth() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const drawing = useRef<Stroke | null>(null);
  const rise = useRef(0);
  const frame = useRef(0);
  const timers = useRef<number[]>([]);
  const phase = useRef<Phase>("blank");
  const [view, setView] = useState<Phase>("blank");
  // Empty on the server and on the first client render, then the real address.
  const path = useSyncExternalStore(() => () => {}, readPath, () => "");

  const setPhase = useCallback((next: Phase) => {
    phase.current = next;
    setView(next);
  }, []);

  const paint = useCallback(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const dpr = el.width / window.innerWidth;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokes.current) waxOn(ctx, s);
    const p = rise.current;
    if (p <= 0) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + 12; x += 12) ctx.lineTo(x, front(x, p, h));
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = COLORS.dye;
    ctx.fillRect(0, 0, w, h);
    for (const s of strokes.current) resist(ctx, s);
    ctx.restore();
  }, []);

  const fit = useCallback(() => {
    const el = canvas.current;
    if (!el) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = Math.round(window.innerWidth * dpr);
    el.height = Math.round(window.innerHeight * dpr);
    paint();
  }, [paint]);

  useEffect(() => {
    fit();
    window.addEventListener("resize", fit);
    const pending = timers.current;
    return () => {
      window.removeEventListener("resize", fit);
      cancelAnimationFrame(frame.current);
      for (const t of pending) window.clearTimeout(t);
    };
  }, [fit]);

  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  const stopKawung = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };

  const onDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (phase.current === "dyed" || e.button > 0) return;
    stopKawung();
    e.currentTarget.setPointerCapture(e.pointerId);
    const s: Stroke = { pts: [[e.clientX, e.clientY]], closed: false };
    drawing.current = s;
    strokes.current.push(s);
    setPhase("waxed");
    paint();
  };

  const onMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const s = drawing.current;
    if (!s) return;
    // Coalesced events keep a fast stroke from turning into straight lines between frames.
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    const list = events.length ? events : [e.nativeEvent];
    for (const ev of list) {
      const last = s.pts[s.pts.length - 1];
      if (Math.hypot(ev.clientX - last[0], ev.clientY - last[1]) < 2) continue;
      s.pts.push([ev.clientX, ev.clientY]);
    }
    paint();
  };

  const onUp = () => {
    drawing.current = null;
  };

  const dip = () => {
    if (phase.current === "dyed") return;
    stopKawung();
    // A kawung still being drawn is finished first, so the dye finds all of it.
    if (kawungLeft.current.length) {
      strokes.current.push(...kawungLeft.current);
      kawungLeft.current = [];
    }
    setPhase("dyed");
    cancelAnimationFrame(frame.current);
    if (reduced()) {
      rise.current = 1;
      paint();
      return;
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / DIP_MS);
      rise.current = ease(t);
      paint();
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  const kawungLeft = useRef<Stroke[]>([]);

  const kawung = () => {
    if (phase.current === "dyed") return;
    stopKawung();
    const all = kawungStrokes(window.innerWidth, window.innerHeight);
    setPhase("waxed");
    if (reduced()) {
      strokes.current.push(...all);
      paint();
      return;
    }
    kawungLeft.current = all;
    const next = () => {
      const s = kawungLeft.current.shift();
      if (!s) return;
      strokes.current.push(s);
      paint();
      if (kawungLeft.current.length) timers.current.push(window.setTimeout(next, 46));
    };
    next();
  };

  const again = () => {
    stopKawung();
    cancelAnimationFrame(frame.current);
    kawungLeft.current = [];
    strokes.current = [];
    rise.current = 0;
    setPhase("blank");
    paint();
  };

  return (
    <div className="nf" data-phase={view}>
      <canvas
        ref={canvas}
        className="nf-canvas"
        role="img"
        aria-label={T.canvasLabel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
      <div className="nf-threads" aria-hidden="true" />

      <div className="nf-text">
        <p className="nf-eyebrow">{T.eyebrow}</p>
        <h1 className="nf-title">
          {T.heading} <code className="nf-path">{path || T.pathFallback}</code>.
        </h1>
        <p className="nf-lede">{T.lede}</p>
        <p className="nf-hint" aria-live="polite">
          {T.hint[view]}
        </p>
      </div>

      <div className="nf-actions">
        {view === "dyed" ? (
          <button type="button" className="nf-btn nf-btn-line" onClick={again}>
            {T.again}
          </button>
        ) : (
          <>
            <button type="button" className="nf-btn nf-btn-solid" onClick={dip}>
              {T.dip}
            </button>
            <button type="button" className="nf-btn nf-btn-line" onClick={kawung}>
              {T.kawung}
            </button>
          </>
        )}
        <Link className="nf-btn nf-btn-link" href="/" prefetch={false}>
          {T.home}
        </Link>
      </div>
      <p className="sr-only" role="status">
        {view === "dyed" ? T.announceDyed : ""}
      </p>
    </div>
  );
}
