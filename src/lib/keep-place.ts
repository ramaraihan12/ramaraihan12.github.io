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
  if (window.innerWidth === width) place = locate(window.scrollY);
};

const onRefresh = () => {
  measure();
  // Until the first scroll, the place is wherever the page loaded.
  place ??= locate(window.scrollY);
};

// ScrollTrigger sends this once a media query change has rebuilt the scenes and it has
// refreshed them, so the marks have just been measured in the new layout.
const onRebuilt = () => {
  const i = marks.findIndex(([key]) => key === place?.key);
  if (!place || i < 0) return;
  const at = marks[i][1];
  jumpToY(at + place.through * ((marks[i + 1]?.[1] ?? at) - at));
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
