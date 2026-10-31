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

/** Where each stage starts in the layout as it is now, for src/lib/keep-place.ts. */
export function stageStarts() {
  const starts: [StageId, number][] = [];
  for (const [id, m] of markers) {
    // Skipped like in measure() while its scene is being rebuilt.
    try {
      starts.push([id, m.at()]);
    } catch {}
  }
  return starts;
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
  measureListeners.forEach((l) => l());
}

/**
 * Index of the current stage and how far (0..1) the reader is toward the next one, for the
 * header's wire. Listeners write it straight to the DOM, so scrolling never re-renders React.
 */
const progressListeners = new Set<(index: number, p: number) => void>();
const measureListeners = new Set<() => void>();
let lastIndex = -1;
let lastP = -1;

function publishProgress(y: number, current: StageId) {
  const i = stages.findIndex((s) => s.id === current);
  const here = cache.get(current);
  const next = stages[i + 1] && cache.get(stages[i + 1].id);
  const span = here && next ? next.at - here.at : 0;
  const p = span > 0 ? Math.min(1, Math.max(0, (y - here!.at) / span)) : 0;
  const q = Math.round(p * 500) / 500;
  if (i === lastIndex && q === lastP) return;
  lastIndex = i;
  lastP = q;
  progressListeners.forEach((l) => l(i, q));
}

/** Calls back right away, then on every change. Returns the unsubscribe. */
export function subscribeProgress(listener: (index: number, p: number) => void) {
  progressListeners.add(listener);
  if (lastIndex >= 0) listener(lastIndex, lastP);
  return () => {
    progressListeners.delete(listener);
  };
}

/** Called after the stages are measured again, which is when their positions can have moved. */
export function subscribeMeasure(listener: () => void) {
  measureListeners.add(listener);
  return () => {
    measureListeners.delete(listener);
  };
}

/** Where each stage starts as a share of the scrollable page, matching the scroll bar. */
export function stageFractions() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return stages.map(({ id }) => {
    const m = cache.get(id);
    return m && max > 0 ? Math.min(1, Math.max(0, m.at / max)) : 0;
  });
}

/*
  Some stages start at the same scroll position (tokens and embed), and a few start earlier than
  where the nav lands (play begins before retrieve's landing spot), so by `at` alone a jump can
  light up its neighbour. The stage a jump was aimed at is remembered: while the page sits where
  that jump put it, that stage is the current one. It lets go on the first scroll away from there,
  or on any input of the reader's own while the page is still travelling. Normal scrolling never
  has an aim, so it goes by `at` as before.
*/
let aim: { id: StageId; y: number; arrived: boolean } | null = null;

function update() {
  const y = window.scrollY;
  let current: StageId = "query";
  for (const { id } of stages) {
    const m = cache.get(id);
    if (m && y >= m.at) current = id;
  }
  if (aim) {
    const off = Math.abs(y - aim.y);
    if (off < 2) {
      aim.arrived = true;
      current = aim.id;
    } else if (aim.arrived && off > 4) {
      aim = null;
    }
  }
  publishProgress(y, current);
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
  Where a page load lands. A link to a section (/#work) and a reload partway down are both placed
  early, while the page is still short: the browser jumps to the anchor or puts the old scroll
  position back before the pinned scenes have added their length, and then the page grows under
  it. So the page places itself again after every refresh, once the scenes are measured: after a
  reload or a step back in history, where the reader was; after a link, where the nav would take
  them. The browser's own restoring stays on. It doesn't undo this, it's right without scripts,
  and it still brings Back to the right spot after an in-page link. Fonts arriving or the game
  changing height measure the page again, so this keeps at it until the reader does something
  themselves. layout.tsx's inline script notes the first wheel, touch, key or click, from before
  the scripts arrive. Later layout changes, like a phone turned sideways, are keep-place.ts's job.
*/

const PLACE = "stage-place";

/** The page's top-level blocks. A pinned scene's is its pin spacer, which keeps its place in the flow. */
const blocks = () => Array.from(document.querySelector("main")?.children ?? []);
const pageTop = (el: Element) => el.getBoundingClientRect().top + window.scrollY;

/**
 * The reader's place as a block and how far into it, which holds up when a block above changes
 * height (a game that was open isn't after a reload).
 */
function savePlace() {
  const all = blocks();
  const i = Math.max(0, all.findLastIndex((el) => pageTop(el) <= window.scrollY));
  if (!all[i]) return;
  try {
    sessionStorage.setItem(PLACE, JSON.stringify({ i, dy: window.scrollY - pageTop(all[i]) }));
  } catch {}
}

function savedPlace(): { i: number; dy: number } | null {
  try {
    return JSON.parse(sessionStorage.getItem(PLACE) ?? "null");
  } catch {
    return null;
  }
}

/** A function, since the answer changes every time the scenes measure the page again. */
function landing(): { y: () => number; stage?: StageId } | undefined {
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const place = nav?.type === "reload" || nav?.type === "back_forward" ? savedPlace() : null;
  if (place) {
    return {
      y: () => {
        const block = blocks()[place.i];
        return block ? pageTop(block) + place.dy : window.scrollY;
      },
    };
  }
  const el = location.hash && document.getElementById(location.hash.slice(1));
  if (!el) return;
  // In a pinned scene, where something is depends on the scroll, so a link into one lands where
  // its stage does: a source in the answer, with the answer written out.
  const host = el.closest(".pin-spacer") ? el.closest(stages.map((s) => s.href).join()) : el;
  const stage = stages.find((s) => s.href === `#${host?.id}`);
  return {
    y: () => {
      const m = stage && markers.get(stage.id);
      return m ? m.to() : pageTop(el) - headerOffset();
    },
    stage: stage?.id,
  };
}

function placeOnLoad() {
  const where = landing();
  let target = where?.y;
  let landed = false;
  const land = () => {
    if (!target) return;
    if (document.documentElement.dataset.moved !== undefined) {
      target = undefined;
      return;
    }
    const y = target();
    if (Math.abs(y - window.scrollY) >= 1) jumpToY(y);
    landed = true;
    if (where?.stage) {
      aim = { id: where.stage, y: Math.round(y), arrived: false };
      update();
    }
  };
  // Before the page was placed, this would save where it was waiting rather than where it was
  // going, so it doesn't. It saves whenever the page goes out of sight too, since a phone can
  // drop a tab in the background without a pagehide and reload it later.
  const save = () => {
    if (landed || !target) savePlace();
  };
  const onHidden = () => {
    if (document.hidden) save();
  };
  ScrollTrigger.addEventListener("refresh", land);
  window.addEventListener("pagehide", save);
  document.addEventListener("visibilitychange", onHidden);
  return () => {
    ScrollTrigger.removeEventListener("refresh", land);
    window.removeEventListener("pagehide", save);
    document.removeEventListener("visibilitychange", onHidden);
  };
}

const dropAim = () => {
  aim = null;
};

export function watchStages() {
  window.addEventListener("scroll", onScroll, { passive: true });
  for (const type of ["wheel", "touchstart", "keydown"]) window.addEventListener(type, dropAim, { passive: true });
  ScrollTrigger.addEventListener("refresh", measure);
  measure();
  const stopPlacing = placeOnLoad();
  return () => {
    window.removeEventListener("scroll", onScroll);
    for (const type of ["wheel", "touchstart", "keydown"]) window.removeEventListener(type, dropAim);
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
  const y = m.to();
  aim = { id, y: Math.round(y), arrived: false };
  scrollToY(y);
  update();
  return true;
}
