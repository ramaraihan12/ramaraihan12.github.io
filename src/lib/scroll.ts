import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

/*
  The scripts' first sign of life, for layout.tsx's fallback. The browser runs this module when
  React reaches the first component that imports it, at the start of hydration, and not at all
  if one of the page's chunks failed to load. On a slow phone that's seconds before the scenes
  are built and startEngine() runs, and the fallback reads this to tell a slow page from a
  broken one. Client modules also run during the static export, where there's no document.
*/
if (typeof document !== "undefined") document.documentElement.dataset.scripts = "running";

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
  page order no matter what was rebuilt. Sections that don't pin (play, tools) get a slot too, so
  every trigger on the page refreshes in page order.
*/
export const PRIORITY = { query: 5, play: 4, tools: 3, work: 2, answer: 1 } as const;

/**
 * Whether the scenes get their pinned, animated layout: motion is allowed, and layout.tsx's
 * fallback hasn't given up on the scripts (data-engine="late"). It only does that when they
 * failed or took far too long, and once the plain page has been shown, it stays plain for this
 * page view.
 *
 * It also puts html.scrolly in step before returning, so the stylesheet already matches when the
 * scene that asked starts measuring. The inline script sets the class before first paint; after
 * that, this is the one place that decides it. That keeps the CSS and the scenes in agreement
 * whichever runs first after a reduced-motion change, gsap.matchMedia rebuilding the scenes or
 * the engine's own listener.
 */
export function scrollyOn() {
  const root = document.documentElement;
  // The scripts are running after all, even if the fallback gave up on the scrolly layout.
  root.classList.add("js");
  const on = root.dataset.engine !== "late" && !matchMedia(REDUCE_MQ).matches;
  root.classList.toggle("scrolly", on);
  return on;
}

let lenis: Lenis | null = null;

function raf(time: number) {
  lenis?.raf(time * 1000);
}

/** Smooth scrolling, driven by GSAP's ticker so ScrollTrigger and Lenis share one frame. */
export function startEngine() {
  const root = document.documentElement;
  const reduce = matchMedia(REDUCE_MQ);

  // Tells layout.tsx's fallback the engine is up, so it stops watching. If it already gave up,
  // "late" stays.
  root.dataset.engine ??= "on";

  const sync = () => {
    scrollyOn();
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

  // Fallback fonts have different widths, and the pinned scenes measure text.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());

  return () => {
    reduce.removeEventListener("change", sync);
    gsap.ticker.remove(raf);
    lenis?.destroy();
    lenis = null;
  };
}

/**
 * Stops the page from scrolling with the wheel or touch, anywhere on it, for something that needs
 * them itself, like the game. Keys and the scrollbar still scroll (base.css keeps the overflow,
 * so nothing shifts), so preventDefault() the keys you use. A no-op when Lenis isn't running
 * (reduced motion): the page scrolls natively then, and the game has to preventDefault() its
 * own wheel and touch events.
 *
 * For the wheel or touch inside one element while the page keeps scrolling, mark that element
 * data-lenis-prevent instead: Lenis leaves its events alone, so they're native there. To keep
 * them from scrolling the page as well, preventDefault() them in a non-passive listener.
 */
export function pauseScroll() {
  lenis?.stop();
}

/** Undoes pauseScroll(). A no-op when nothing is paused or Lenis isn't running. */
export function resumeScroll() {
  lenis?.start();
}

/** Smooth-scrolls to y. A jump from the nav or a focus change resumes a paused page first. */
export function scrollToY(y: number) {
  const top = Math.max(0, Math.round(y));
  if (lenis) {
    lenis.start();
    lenis.scrollTo(top, { duration: 1.4 });
  } else {
    window.scrollTo({ top, behavior: matchMedia(REDUCE_MQ).matches ? "auto" : "smooth" });
  }
}

/**
 * Puts the page at y at once, for putting the reader back after the layout changed under them.
 * The scenes show that spot straight away too, instead of scrubbing their way over to it.
 */
export function jumpToY(y: number) {
  const top = Math.max(0, Math.round(y));
  if (lenis) {
    // Lenis measures the page on its own schedule, and with the old height it would stop short.
    lenis.resize();
    lenis.scrollTo(top, { immediate: true, force: true });
  } else {
    window.scrollTo(0, top);
  }
  ScrollTrigger.update();
  for (const trigger of ScrollTrigger.getAll()) {
    const scrub = trigger.getTween();
    if (scrub?.isActive()) scrub.progress(1);
  }
}
