"use client";

import { useEffect } from "react";
import "lenis/dist/lenis.css";
import { startEngine } from "@/lib/scroll";
import { watchStages } from "@/lib/stage";

/**
 * Starts smooth scrolling and stage tracking. Being rendered first doesn't make this run first:
 * the scenes set up in useGSAP, a layout effect, and React runs every layout effect before any
 * useEffect. So the scenes are built by the time Lenis starts. That's fine, because neither
 * needs the other at setup, and which layout the scenes build doesn't depend on this order
 * either; scrollyOn() in src/lib/scroll.ts decides that for both.
 *
 * So this effect is about the last thing a page load does, and startEngine() setting
 * data-engine="on" here is how layout.tsx's fallback learns the engine is up. On a slow phone
 * that can be many seconds after the scripts arrived, so the fallback doesn't count the wait as
 * a failure: src/lib/scroll.ts marks the scripts as running as soon as the browser runs it, and
 * with that mark there, the fallback waits for this (up to its 20-second cap).
 *
 * Moving this to a layout effect would change when ScrollTrigger's first full refresh happens,
 * and the answer scene's header-tone trigger relies on today's timing (it reads the answer
 * timeline's start, which can still be 0 in an earlier refresh).
 */
export function ScrollEngine() {
  useEffect(() => {
    const stop = startEngine();
    const unwatch = watchStages();
    return () => {
      unwatch();
      stop();
    };
  }, []);
  return null;
}
