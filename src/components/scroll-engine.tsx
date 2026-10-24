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
