import gsap from "gsap";

/*
  Token chips you can pick up and fling. Let go and a small spring pulls each one back to its
  slot, with a wobble on the way. The scene turns it on only while the timeline rests on the
  tokenized state, and off again before the tokens collapse into the query dot.

  Phones: at that point the chips cover most of the screen, so a drag must never eat the scroll.
  The chips get touch-action: pan-y (in query.css), which leaves every vertical swipe to the
  browser, so the page scrolls exactly as it does anywhere else. A touch only picks a chip up
  once it has moved sideways more than down; after that it follows the finger both ways.
  Mouse and pen pick a chip up straight away.

  The offset goes in the CSS translate and rotate properties, not transform, so it adds to the
  timeline's own x, y and scale on the same chips instead of fighting them.
*/

/** Spring stiffness and damping, per second. Damped to about two visible bounces. */
const STIFFNESS = 240;
const DAMPING = 17;
/** How far a touch has to travel sideways before it picks a chip up, in pixels. */
const TOUCH_SLOP = 8;

type Chip = { el: HTMLElement; x: number; y: number; vx: number; vy: number; tilt: number; held: boolean };
type Grab = { chip: Chip; id: number; sx: number; sy: number; ox: number; oy: number; lx: number; ly: number; lt: number; live: boolean };

// A rubber band: one to one up close, a little heavier the further it goes.
const soft = (d: number) => d / (1 + Math.abs(d) / 900);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function chipDrag(els: HTMLElement[], host: HTMLElement) {
  const chips: Chip[] = els.map((el) => ({ el, x: 0, y: 0, vx: 0, vy: 0, tilt: 0, held: false }));
  let on = false;
  let ticking = false;
  let grab: Grab | null = null;

  const write = (c: Chip) => {
    c.el.style.translate = c.x || c.y ? `${c.x.toFixed(2)}px ${c.y.toFixed(2)}px` : "";
    c.el.style.rotate = c.tilt ? `${c.tilt.toFixed(2)}deg` : "";
  };

  const tick = (_time: number, deltaMs: number) => {
    const dt = Math.min(deltaMs, 34) / 1000;
    let busy = false;
    for (const c of chips) {
      if (c.held) {
        busy = true;
        continue;
      }
      if (!c.x && !c.y && !c.tilt) continue;
      // Semi-implicit Euler: velocity first, then position. Stable at these settings.
      c.vx += (-STIFFNESS * c.x - DAMPING * c.vx) * dt;
      c.vy += (-STIFFNESS * c.y - DAMPING * c.vy) * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.tilt += (clamp(c.vx * 0.01, -8, 8) - c.tilt) * Math.min(1, dt * 14);
      if (Math.abs(c.x) + Math.abs(c.y) < 0.1 && Math.abs(c.vx) + Math.abs(c.vy) < 2 && Math.abs(c.tilt) < 0.05) {
        Object.assign(c, { x: 0, y: 0, vx: 0, vy: 0, tilt: 0 });
      } else {
        busy = true;
      }
      write(c);
    }
    if (!busy) stopTicking();
  };

  const startTicking = () => {
    if (ticking) return;
    ticking = true;
    gsap.ticker.add(tick);
  };
  const stopTicking = () => {
    if (!ticking) return;
    ticking = false;
    gsap.ticker.remove(tick);
  };

  const pickUp = (g: Grab) => {
    g.live = true;
    g.chip.held = true;
    g.chip.el.classList.add("is-held");
    try {
      g.chip.el.setPointerCapture(g.id);
    } catch {}
    startTicking();
  };

  const letGo = () => {
    if (!grab) return;
    const { chip, id } = grab;
    grab = null;
    chip.held = false;
    chip.el.classList.remove("is-held");
    if (chip.el.hasPointerCapture?.(id)) chip.el.releasePointerCapture(id);
    startTicking();
  };

  const down = (chip: Chip) => (e: PointerEvent) => {
    if (!on || grab || (e.pointerType === "mouse" && e.button !== 0)) return;
    grab = { chip, id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: chip.x, oy: chip.y, lx: e.clientX, ly: e.clientY, lt: e.timeStamp, live: false };
    if (e.pointerType !== "touch") {
      e.preventDefault();
      pickUp(grab);
    }
  };

  const move = (e: PointerEvent) => {
    const g = grab;
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.sx;
    const dy = e.clientY - g.sy;
    if (!g.live) {
      if (Math.abs(dx) < TOUCH_SLOP || Math.abs(dx) < Math.abs(dy)) return;
      pickUp(g);
    }
    const c = g.chip;
    const dt = Math.max(8, e.timeStamp - g.lt) / 1000;
    c.vx = c.vx * 0.5 + ((e.clientX - g.lx) / dt) * 0.5;
    c.vy = c.vy * 0.5 + ((e.clientY - g.ly) / dt) * 0.5;
    g.lx = e.clientX;
    g.ly = e.clientY;
    g.lt = e.timeStamp;
    c.x = g.ox + soft(dx);
    c.y = g.oy + soft(dy);
    c.tilt += (clamp(c.vx * 0.012, -10, 10) - c.tilt) * 0.35;
    write(c);
  };

  const up = (e: PointerEvent) => {
    if (grab && e.pointerId === grab.id) letGo();
  };

  const handlers = chips.map((chip) => ({ chip, onDown: down(chip) }));
  for (const { chip, onDown } of handlers) {
    chip.el.addEventListener("pointerdown", onDown);
    chip.el.addEventListener("pointermove", move);
    chip.el.addEventListener("pointerup", up);
    chip.el.addEventListener("pointercancel", up);
    chip.el.addEventListener("lostpointercapture", up);
  }

  const settle = () => {
    letGo();
    stopTicking();
    for (const c of chips) {
      Object.assign(c, { x: 0, y: 0, vx: 0, vy: 0, tilt: 0 });
      write(c);
    }
  };

  return {
    /** Turns dragging on or off. Off puts every chip straight back in its slot. */
    set(enabled: boolean) {
      if (enabled === on) return;
      on = enabled;
      host.classList.toggle("is-draggable", on);
      if (!on) settle();
    },
    kill() {
      on = false;
      host.classList.remove("is-draggable");
      settle();
      for (const { chip, onDown } of handlers) {
        chip.el.removeEventListener("pointerdown", onDown);
        chip.el.removeEventListener("pointermove", move);
        chip.el.removeEventListener("pointerup", up);
        chip.el.removeEventListener("pointercancel", up);
        chip.el.removeEventListener("lostpointercapture", up);
      }
    },
  };
}
