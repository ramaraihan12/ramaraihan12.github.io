import { ScrollTrigger } from "gsap/ScrollTrigger";
import { stages, type StageId } from "@/content/story";
import { jumpToY, scrollToY } from "./scroll";

/**
 * Which stop of the pipeline you're at. Each stage registers where it starts (`at`) and where
 * a click in the nav should land (`to`), both as scroll positions. Pinned scenes register
 * positions inside their timeline; everything else is measured from its element.
 */
type Marker = { at: () => number; to: () => number };

const markers = new Map<StageId, Marker>();
const cache = new Map<StageId, { at: number; to: number }>();
const listeners = new Set<() => void>();
let active: StageId = "query";

const headerOffset = () => document.querySelector(".site-header")?.clientHeight ?? 0;

/** Marker for a section in normal flow: active once its top passes the middle of the screen. */
export function elementMarker(el: Element): Marker {
  const top = () => el.getBoundingClientRect().top + window.scrollY;
  return { at: () => top() - window.innerHeight * 0.5, to: () => top() - headerOffset() };
}

/** Returns a function that removes the marker again, for the scene's cleanup. */
export function setMarker(id: StageId, marker: Marker) {
  markers.set(id, marker);
  measure();
  return () => {
    if (markers.get(id) === marker) markers.delete(id);
  };
}

/** Registers several markers and returns one cleanup for all of them. */
export function setMarkers(entries: [StageId, Marker][]) {
  const removers = entries.map(([id, m]) => setMarker(id, m));
  return () => removers.forEach((remove) => remove());
}

function measure() {
  cache.clear();
  for (const [id, m] of markers) {
    // A scene that's halfway through being rebuilt can't be measured yet. It registers again
    // once it's ready, and the next refresh picks it up.
    try {
      cache.set(id, { at: m.at(), to: m.to() });
    } catch {}
  }
  update();
}

function update() {
  const y = window.scrollY;
  let current: StageId = "query";
  for (const { id } of stages) {
    const m = cache.get(id);
    if (m && y >= m.at) current = id;
  }
  if (current !== active) {
    active = current;
    listeners.forEach((l) => l());
  }
}

let frame = 0;
function onScroll() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(update);
}

/*
  Where a link to a section (/#work) lands. The browser jumps to the anchor early, while the page
  is still short, before the pinned scenes have added their length, and then the page grows under
  it. So the page places itself again after every refresh, once the scenes are measured, where the
  nav would take the reader. Fonts arriving or the game changing height measure the page again,
  so this keeps at it until the reader does something themselves. layout.tsx's inline script
  notes the first wheel, touch, key or click, from before the scripts arrive. Later layout
  changes, like a phone turned sideways, are keep-place.ts's job.
*/

const pageTop = (el: Element) => el.getBoundingClientRect().top + window.scrollY;

/** A function, since the answer changes every time the scenes measure the page again. */
function landing(): (() => number) | undefined {
  const el = location.hash && document.getElementById(location.hash.slice(1));
  if (!el) return;
  return () => {
    // In a pinned scene, where something is depends on the scroll, so a link into one lands where
    // its stage does: a source in the answer, with the answer written out.
    const host = el.closest(".pin-spacer") ? el.closest(stages.map((s) => s.href).join()) : el;
    const stage = stages.find((s) => s.href === `#${host?.id}`);
    const m = stage && markers.get(stage.id);
    return m ? m.to() : pageTop(el) - headerOffset();
  };
}

function placeOnLoad() {
  let target = landing();
  const land = () => {
    if (!target) return;
    if (document.documentElement.dataset.moved !== undefined) {
      target = undefined;
      return;
    }
    const y = target();
    if (Math.abs(y - window.scrollY) >= 1) jumpToY(y);
  };
  ScrollTrigger.addEventListener("refresh", land);
  return () => ScrollTrigger.removeEventListener("refresh", land);
}

export function watchStages() {
  window.addEventListener("scroll", onScroll, { passive: true });
  ScrollTrigger.addEventListener("refresh", measure);
  measure();
  const stopPlacing = placeOnLoad();
  return () => {
    window.removeEventListener("scroll", onScroll);
    ScrollTrigger.removeEventListener("refresh", measure);
    stopPlacing();
  };
}

export function subscribeStage(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getStage = () => active;

/** Returns false when the stage has no marker yet, so the link can fall back to its href. */
export function goToStage(id: StageId) {
  const m = markers.get(id);
  if (!m) return false;
  scrollToY(m.to());
  return true;
}
