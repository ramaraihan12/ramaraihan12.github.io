"use client";

import Link from "next/link";
import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { rng, wobble } from "@/components/art/rng";
import "@/styles/not-found.css";
import { notFoundCopy as T } from "./not-found-copy";

/*
  The 404 page: a blank cloth. Draw on it with the pointer and that's wax; press Dip and the cloth
  goes nila from the bottom up, except under the wax, which stays the colour of the cotton. That's
  how batik is made (malam keeps the dye out), so a wrong address ends up with a small lesson in it.

  One canvas. Strokes are kept as points in screen pixels, so a resize or the dye can draw them
  again. Wax is drawn opaque, which lets the newest stroke be drawn over itself while the pointer
  moves, so a move only draws the stroke in hand. The dye is a fill clipped below a wavy front that rises with the animation: first every
  stroke in wax colours, then the dye over them, then the strokes again in cotton colour inside
  the dye. Only the dip animates, and only that one frame loop runs. With reduced motion the
  front jumps to the top and the kawung appears at once.

  While the dye rises, a pale copy of the words is clipped to the same front, so each line turns
  light just as the dye reaches it, and the real words and buttons swap over when it is done.

  Styles are in src/styles/not-found.css, loaded with this file only.
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
const MAX_PATH = 32;

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
type Rect = { left: number; top: number; right: number; bottom: number };
const hits = (a: Rect, b: Rect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const pad = (r: Rect, n: number): Rect => ({ left: r.left - n, top: r.top - n, right: r.right + n, bottom: r.bottom + n });

function kawungStrokes(w: number, h: number, text: Rect, actions: Rect): Stroke[] {
  const r = rng(404);
  const gap = 20;
  const wide = w > h;
  // The free part of the cloth: beside the words on a wide screen, under them on a tall one,
  // and in both cases above the buttons.
  const free: Rect = wide
    ? { left: text.right + gap, top: gap, right: w - gap, bottom: actions.top - gap }
    : { left: gap, top: text.bottom + gap, right: w - gap, bottom: actions.top - gap };
  const fw = Math.max(120, free.right - free.left);
  const fh = Math.max(120, free.bottom - free.top);
  const rings = Math.min(fw, fh) < 380 ? 2 : 3;
  const s = Math.max(40, Math.min(112, Math.min(fw, fh) / (rings * 2 + 1.4)));
  const cx = free.left + fw / 2;
  const cy = free.top + fh / 2;
  const half = (s * Math.SQRT2) / 4;
  const a = half * 0.88;
  const b = a * 0.62;
  const keepOut = [pad(actions, 8), pad(text, 4)];
  const clear = (x: number, y: number, rad: number) => {
    const box: Rect = { left: x - rad, top: y - rad, right: x + rad, bottom: y + rad };
    return !keepOut.some((k) => hits(box, k));
  };
  const flowers: { x: number; y: number; d: number }[] = [];
  for (let i = -rings; i <= rings; i++) {
    for (let j = -rings; j <= rings; j++) {
      if ((i + j) % 2 !== 0) continue;
      const d = Math.hypot(i, j);
      if (d > rings) continue;
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
      if (px < a || px > w - a || py < a || py > h - a) continue;
      if (!clear(px, py, a * 1.2)) continue;
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
    if (!clear(f.x, f.y, 6)) continue;
    const heart: Pt[] = Array.from({ length: 10 }, (_, n) => {
      const t = (n / 10) * Math.PI * 2;
      return [f.x + Math.cos(t) * 3.2 + wobble(r, 0.5), f.y + Math.sin(t) * 3.2 + wobble(r, 0.5)] as const;
    });
    out.push({ pts: heart, closed: true });
  }
  return out;
}

type Phase = "blank" | "waxed" | "dipping" | "dyed";

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
  const pale = useRef<HTMLDivElement>(null);
  const textEl = useRef<HTMLDivElement>(null);
  const actionsEl = useRef<HTMLDivElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const drawing = useRef<Stroke | null>(null);
  const pointer = useRef(-1);
  const rise = useRef(0);
  const frame = useRef(0);
  const timers = useRef<number[]>([]);
  const kawungLeft = useRef<Stroke[]>([]);
  const phase = useRef<Phase>("blank");
  const [view, setView] = useState<Phase>("blank");
  // Dipped with no wax on it: the hint says so instead of claiming the wax held.
  const [plain, setPlain] = useState(false);
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

  /** The pale words follow the same edge as the dye. */
  const clipPale = useCallback((p: number) => {
    const el = pale.current;
    if (!el) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pts = [`0 ${h}px`];
    for (let x = 0; x <= w + 12; x += 12) pts.push(`${x}px ${front(x, p, h).toFixed(1)}px`);
    pts.push(`${w}px ${h}px`);
    el.style.clipPath = `polygon(${pts.join(",")})`;
  }, []);

  const fit = useCallback(() => {
    const el = canvas.current;
    if (!el) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = Math.round(window.innerWidth * dpr);
    el.height = Math.round(window.innerHeight * dpr);
    paint();
    if (phase.current === "dipping") clipPale(rise.current);
  }, [paint, clipPale]);

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
  const locked = () => phase.current === "dipping" || phase.current === "dyed";

  const stopKawung = () => {
    for (const t of timers.current) window.clearTimeout(t);
    // Emptied in place: the cleanup holds this same array.
    timers.current.length = 0;
  };

  const onDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (locked() || e.button > 0 || drawing.current) return;
    stopKawung();
    e.currentTarget.setPointerCapture(e.pointerId);
    const s: Stroke = { pts: [[e.clientX, e.clientY]], closed: false };
    drawing.current = s;
    pointer.current = e.pointerId;
    strokes.current.push(s);
    setPhase("waxed");
    paint();
  };

  const onMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const s = drawing.current;
    if (!s || e.pointerId !== pointer.current) return;
    // Coalesced events keep a fast stroke from turning into straight lines between frames.
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    const list = events.length ? events : [e.nativeEvent];
    for (const ev of list) {
      const last = s.pts[s.pts.length - 1];
      if (Math.hypot(ev.clientX - last[0], ev.clientY - last[1]) < 2) continue;
      s.pts.push([ev.clientX, ev.clientY]);
    }
    // Only the stroke in hand: wax is opaque, so drawing it again over itself is enough.
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const dpr = el.width / window.innerWidth;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    waxOn(ctx, s);
  };

  const onUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.pointerId !== pointer.current) return;
    drawing.current = null;
    pointer.current = -1;
  };

  const dip = () => {
    if (locked()) return;
    stopKawung();
    // A kawung still being drawn is finished first, so the dye finds all of it.
    if (kawungLeft.current.length) {
      strokes.current.push(...kawungLeft.current);
      kawungLeft.current = [];
    }
    drawing.current = null;
    pointer.current = -1;
    setPlain(strokes.current.length === 0);
    cancelAnimationFrame(frame.current);
    if (reduced()) {
      rise.current = 1;
      paint();
      setPhase("dyed");
      return;
    }
    // Words and buttons keep their waxed look until the dye has passed them.
    setPhase("dipping");
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / DIP_MS);
      rise.current = ease(t);
      paint();
      if (t < 1) {
        clipPale(rise.current);
        frame.current = requestAnimationFrame(tick);
      } else {
        setPhase("dyed");
      }
    };
    frame.current = requestAnimationFrame(tick);
  };

  const kawung = () => {
    if (locked()) return;
    stopKawung();
    const text = textEl.current?.getBoundingClientRect();
    const actions = actionsEl.current?.getBoundingClientRect();
    if (!text || !actions) return;
    const all = kawungStrokes(window.innerWidth, window.innerHeight, text, actions);
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
    setPlain(false);
    setPhase("blank");
    paint();
  };

  const dipping = view === "dipping";
  const hint =
    view === "dyed"
      ? plain
        ? T.hint.plain
        : T.hint.dyed
      : dipping
        ? T.hint.dipping
        : T.hint[view];

  // The button that was pressed goes away (Dip becomes Wax again and back), so focus follows it
  // instead of dropping to the page. Only when focus was on that button or already lost.
  const dipBtn = useRef<HTMLButtonElement>(null);
  const againBtn = useRef<HTMLButtonElement>(null);
  const lastView = useRef<Phase>("blank");
  useEffect(() => {
    const was = lastView.current;
    lastView.current = view;
    const at = document.activeElement;
    const lost = !at || at === document.body || at === dipBtn.current || at === againBtn.current;
    if (!lost) return;
    if (view === "dyed" && was !== "dyed") againBtn.current?.focus({ preventScroll: true });
    else if (view === "blank" && was === "dyed") dipBtn.current?.focus({ preventScroll: true });
  }, [view]);

  /** The words and buttons. Drawn twice while dipping: the real ones, and a pale copy over them. */
  const layer = (isPale: boolean) => (
    <div className={isPale ? "nf-layer nf-pale" : "nf-layer"} ref={isPale ? pale : undefined} aria-hidden={isPale || undefined}>
      <div className="nf-text" ref={isPale ? undefined : textEl}>
        <p className="nf-eyebrow">{T.eyebrow}</p>
        <h1 className="nf-title">
          {T.heading} <code className="nf-path">{path || T.pathFallback}</code>
          {path.endsWith("…") ? "" : "."}
        </h1>
        <p className="nf-lede">{T.lede}</p>
        <p className="nf-hint">{hint}</p>
      </div>

      <div className="nf-actions" ref={isPale ? undefined : actionsEl}>
        {view === "dyed" ? (
          <button type="button" className="nf-btn nf-btn-line" onClick={again} ref={isPale ? undefined : againBtn}>
            {T.again}
          </button>
        ) : (
          <>
            <button type="button" className="nf-btn nf-btn-solid" onClick={dip} aria-disabled={dipping || undefined} ref={isPale ? undefined : dipBtn} tabIndex={isPale ? -1 : undefined}>
              {T.dip}
            </button>
            <button type="button" className="nf-btn nf-btn-line" onClick={kawung} aria-disabled={dipping || undefined} tabIndex={isPale ? -1 : undefined}>
              {T.kawung}
            </button>
          </>
        )}
        {isPale ? (
          <span className="nf-btn nf-btn-link">{T.home}</span>
        ) : (
          <Link className="nf-btn nf-btn-link" href="/" prefetch={false}>
            {T.home}
          </Link>
        )}
      </div>
    </div>
  );

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
      {layer(false)}
      {dipping ? layer(true) : null}
      <p className="sr-only" role="status">
        {view === "dyed" ? T.announceDyed : ""}
      </p>
    </div>
  );
}
