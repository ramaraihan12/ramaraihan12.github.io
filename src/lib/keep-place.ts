import { ScrollTrigger } from "gsap/ScrollTrigger";
import { jumpToY } from "./scroll";
import { stageStarts } from "./stage";

/*
  Turning a phone, or resizing a window across one of the breakpoints in scroll.ts, rebuilds
  the scenes for the other layout. Pins come and go and the page can change height by half, so
  the old scroll position points somewhere else afterwards. ScrollTrigger means to put it back
  but loses it on the way: it saves the position when the media query changes, and a rebuilt
  scene's trigger that isn't on a timeline refreshes on its own as soon as it's made, which
  clears what was saved. The full refresh after that measures from the top and has nothing to
  go back to, so the reader landed at the top of the page.

  So this keeps the reader's place in the content instead. The page is cut up at the top of
  each section and wherever a stage starts, since a pinned scene and its plain version share
  out their stages differently, and the place is the piece the top of the screen is in and how
  far through it. It's read as they scroll, against the layout ScrollTrigger last measured, and
  put back as soon as the rebuilt page has been measured. Resizes that don't cross a breakpoint
  rebuild nothing, and ScrollTrigger keeps their position on its own.
*/

type Mark = [key: string, at: number];

/*
  Inside the work section the place is a project, not a share of the section: the deck, the
  stacked panels and the sideways rail are three different lengths, so the same share is a
  different project in each. The work scene says which layout it has now by registering an
  anchor: `read` tells which project is in view at a scroll position (or null outside the
  section), `put` where a project sits in the layout as it is (or null when the scene places it
  itself, as the deck does by sliding to the card). The project is read as they scroll, like the
  place, and put back right after the fraction has been.
*/
export type Anchor = { read: (y: number) => number | null; put: (project: number) => number | null };
let anchor: Anchor | null = null;
let project: number | null = null;

export function setAnchor(next: Anchor) {
  anchor = next;
  return () => {
    if (anchor === next) anchor = null;
  };
}

/** For an anchor whose answer changes without the page scrolling, like the deck sliding to another card. */
export function anchorMoved() {
  if (window.innerWidth === width) project = anchor?.read(window.scrollY) ?? null;
}

/** The project that was in view before the layout last changed, if the reader was in the work section. */
export const anchoredProject = () => project;

let marks: Mark[] = [];
// The width the marks were measured at. While the window is being resized they're out of
// date, and the browser may already have moved the scroll position to suit the new width.
let width = 0;
let place: { key: string; through: number } | null = null;

function measure() {
  const y = window.scrollY;
  const sections = [...document.querySelectorAll("main > *")].map(
    (el, i): Mark => [`section ${i}`, el.getBoundingClientRect().top + y],
  );
  const end: Mark = ["end", document.documentElement.scrollHeight - window.innerHeight];
  marks = [...sections, ...stageStarts(), end].sort((a, b) => a[1] - b[1]);
  width = window.innerWidth;
}

function locate(y: number) {
  let i = 0;
  marks.forEach(([, at], j) => {
    if (y >= at) i = j;
  });
  if (!marks[i]) return null;
  const [key, at] = marks[i];
  const length = (marks[i + 1]?.[1] ?? at) - at;
  return { key, through: length > 0 ? Math.min(1, Math.max(0, (y - at) / length)) : 0 };
}

const onScroll = () => {
  if (window.innerWidth !== width) return;
  place = locate(window.scrollY);
  project = anchor?.read(window.scrollY) ?? null;
};

const onRefresh = () => {
  measure();
  // Until the first scroll, the place is wherever the page loaded.
  if (!place) {
    place = locate(window.scrollY);
    project = anchor?.read(window.scrollY) ?? null;
  }
};

// ScrollTrigger sends this once a media query change has rebuilt the scenes and it has
// refreshed them, so the marks have just been measured in the new layout.
const onRebuilt = () => {
  const i = marks.findIndex(([key]) => key === place?.key);
  if (!place || i < 0) return;
  const at = marks[i][1];
  jumpToY(at + place.through * ((marks[i + 1]?.[1] ?? at) - at));
  const y = project != null ? anchor?.put(project) : null;
  if (y != null) jumpToY(y);
};

export function keepPlace() {
  window.addEventListener("scroll", onScroll, { passive: true });
  ScrollTrigger.addEventListener("refresh", onRefresh);
  ScrollTrigger.addEventListener("matchMedia", onRebuilt);
  return () => {
    window.removeEventListener("scroll", onScroll);
    ScrollTrigger.removeEventListener("refresh", onRefresh);
    ScrollTrigger.removeEventListener("matchMedia", onRebuilt);
  };
}
