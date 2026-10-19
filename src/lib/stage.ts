import { ScrollTrigger } from "gsap/ScrollTrigger";
import { stages, type StageId } from "@/content/story";
import { scrollToY } from "./scroll";

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

export function watchStages() {
  window.addEventListener("scroll", onScroll, { passive: true });
  ScrollTrigger.addEventListener("refresh", measure);
  measure();
  return () => {
    window.removeEventListener("scroll", onScroll);
    ScrollTrigger.removeEventListener("refresh", measure);
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
