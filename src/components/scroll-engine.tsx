"use client";

import { useEffect } from "react";
import "lenis/dist/lenis.css";
import { startEngine } from "@/lib/scroll";
import { watchStages } from "@/lib/stage";

/** Starts smooth scrolling and stage tracking. Rendered first so it runs before the scenes. */
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
