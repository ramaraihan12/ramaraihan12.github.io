"use client";

import { type AnimationEvent, useCallback, useEffect, useRef, useState } from "react";
import { handRect } from "@/components/art/draw";
import { batikDataUri } from "@/components/art/patterns";
import { hash, rng } from "@/components/art/rng";

/*
  Batik mode: the page dipped in dye for a moment. Parang floods out from the middle of the
  screen with a dark wet edge (a clip-path circle), a label is pressed onto the cloth, and after
  a few seconds the dye rinses off from the top down. Loaded only when the code is entered.

  It sits over everything but takes no clicks and is hidden from screen readers; the component
  that starts it says what's happening. Any key, tap or wheel rinses it early. The phases are
  CSS animations in extras.css, each one handing over to the next when it ends.
*/

export type DipProps = {
  title: string;
  line: string;
  /** Called once the dye has rinsed off. */
  onDone: () => void;
};

type Phase = "flood" | "hold" | "rinse";

/** How long the dye sits before it rinses. */
const HOLD = 4000;
/** Fallbacks in case an animation never reports its end. Longer than the CSS durations. */
const FLOOD_MAX = 1800;
const RINSE_MAX = 2400;
/** The last keys of the code are still coming in for a moment; don't let them rinse it. */
const GRACE = 700;

type Cloth = { parang: string; kawung: string; frame: [string, string] };
let cloth: Cloth | null = null;

function weave(): Cloth {
  if (!cloth) {
    const r = rng(hash("batik mode"));
    cloth = {
      parang: batikDataUri("parang", { ink: "#f4b223", ground: "#0f1a47", tint: "#8a5a2b" }),
      // Tone on tone, a lighter nila on nila, so the words on it stay easy to read.
      kawung: batikDataUri("kawung", { ink: "#2c3d86", ground: "#0f1a47", scale: 0.7 }),
      frame: [handRect(2, 2.5, 96, 35, r, { wave: 0.9, over: 1.4 }), handRect(4.2, 6.5, 91.6, 27, r, { wave: 0.6 })],
    };
  }
  return cloth;
}

export function Dip({ title, line, onDone }: DipProps) {
  const [phase, setPhase] = useState<Phase>("flood");
  const now = useRef<Phase>("flood");
  const rinseSoon = useRef(false);
  const done = useRef(false);
  const { parang, kawung, frame } = weave();

  const go = useCallback((p: Phase) => {
    now.current = p;
    setPhase(p);
  }, []);

  const advance = useCallback(() => {
    if (now.current === "flood") go(rinseSoon.current ? "rinse" : "hold");
    else if (now.current === "hold") go("rinse");
    else if (!done.current) {
      done.current = true;
      onDone();
    }
  }, [go, onDone]);

  // Each phase moves on by itself after a while: the hold by design, the others only if their
  // animation doesn't end (animations switched off, a background tab).
  useEffect(() => {
    const timer = window.setTimeout(advance, phase === "hold" ? HOLD : phase === "flood" ? FLOOD_MAX : RINSE_MAX);
    return () => window.clearTimeout(timer);
  }, [phase, advance]);

  // A key, a tap or a scroll means "I'd like my page back".
  useEffect(() => {
    const start = performance.now();
    const rinse = (e: Event) => {
      if (e instanceof KeyboardEvent && (/^(Shift|Control|Alt|Meta)$/.test(e.key) || performance.now() - start < GRACE)) return;
      if (now.current === "hold") go("rinse");
      else if (now.current === "flood") rinseSoon.current = true;
    };
    window.addEventListener("keydown", rinse);
    window.addEventListener("pointerdown", rinse);
    window.addEventListener("wheel", rinse, { passive: true });
    return () => {
      window.removeEventListener("keydown", rinse);
      window.removeEventListener("pointerdown", rinse);
      window.removeEventListener("wheel", rinse);
    };
  }, [go]);

  const onAnimationEnd = (e: AnimationEvent) => {
    if (e.target === e.currentTarget && now.current !== "hold") advance();
  };

  return (
    <div className="rr-dip" data-phase={phase} aria-hidden="true" style={{ backgroundImage: parang }} onAnimationEnd={onAnimationEnd}>
      <div className="rr-dip-card" style={{ backgroundImage: kawung }}>
        <svg className="rr-dip-frame" viewBox="0 0 100 40" preserveAspectRatio="none" focusable="false">
          <path d={frame[0]} vectorEffect="non-scaling-stroke" strokeWidth="2" />
          <path d={frame[1]} vectorEffect="non-scaling-stroke" strokeWidth="1" />
        </svg>
        <p className="rr-dip-title">{title}</p>
        <p className="rr-dip-line">{line}</p>
      </div>
    </div>
  );
}
