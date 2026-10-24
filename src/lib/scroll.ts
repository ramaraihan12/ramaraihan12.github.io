import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

/*
  The pinned scenes need some room. Below these sizes, or with reduced motion, the page is a
  plain document and every scene shows its content in normal flow. The pinned layouts in
  src/styles/ use the same queries, so keep them in sync.
*/
export const SCENE_MQ = "(min-height: 520px)";
export const RAIL_MQ = "(min-width: 768px) and (min-height: 560px)";
export const MOBILE_MQ = "(max-width: 767px)";
export const REDUCE_MQ = "(prefers-reduced-motion: reduce)";

/*
  ScrollTrigger refreshes triggers in the order they were made. A resize can rebuild one scene's
  triggers while the scenes below keep theirs, and then the lower ones would be measured before
  the pins above them exist. A priority per scene, highest at the top of the page, keeps the
  page order no matter what was rebuilt.
*/
export const PRIORITY = { query: 4, tools: 3, work: 2, answer: 1 } as const;

/** Set before first paint by the inline script in layout.tsx. */
export function scrollyOn() {
  return document.documentElement.classList.contains("scrolly");
}

let lenis: Lenis | null = null;

function raf(time: number) {
  lenis?.raf(time * 1000);
}

/** Smooth scrolling, driven by GSAP's ticker so ScrollTrigger and Lenis share one frame. */
export function startEngine() {
  const root = document.documentElement;
  const reduce = matchMedia(REDUCE_MQ);

  const sync = () => {
    root.classList.toggle("scrolly", !reduce.matches);
    if (!reduce.matches && !lenis) {
      lenis = new Lenis({ lerp: 0.11 });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
    } else if (reduce.matches && lenis) {
      gsap.ticker.remove(raf);
      lenis.destroy();
      lenis = null;
    }
  };

  sync();
  reduce.addEventListener("change", sync);
  root.dataset.engine = "on";

  // Fallback fonts have different widths, and the pinned scenes measure text.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());

  return () => {
    reduce.removeEventListener("change", sync);
    gsap.ticker.remove(raf);
    lenis?.destroy();
    lenis = null;
  };
}

export function scrollToY(y: number) {
  const top = Math.max(0, Math.round(y));
  if (lenis) {
    lenis.scrollTo(top, { duration: 1.4 });
  } else {
    window.scrollTo({ top, behavior: matchMedia(REDUCE_MQ).matches ? "auto" : "smooth" });
  }
}
