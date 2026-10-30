import { Landscape } from "@/components/art/landscape";
import { skyAtHour } from "@/components/art/sky";

/*
  Merbabu at quarter to six in the morning, behind the question. The sky is fixed: the live sky
  over Salatiga belongs to the contact section at the end of the page.

  Rendered on the server, so the drawing's geometry never ships as JavaScript. The sun inside
  the SVG is for the plain page (no scripts, or reduced motion). The pinned scene hides it and
  uses its own sun (.qs-sun), which can leave the sky and drop down to become the query dot.
  Alive on its own, in hero.css: the truntum stars come on one by one and breathe, Merapi's
  smoke is blown east and drifts, and the sun carries a faint kawung (the pinned scene's .qs-sun
  has the same one, so the sun that becomes the query dot is the same object).
  Its shapes are the page's copy of the mountains: the contact section draws the same ones
  through <use> rather than carrying them again.
*/

const MORNING = skyAtHour(5.75);

/** Where the sun sits on the plain page, as fractions of the drawing: over Merbabu's long north ridge. */
const SUN = { x: 0.8, y: 0.4, r: 26 } as const;

export function HeroLand() {
  return (
    <div className="qs-land" aria-hidden="true">
      <Landscape
        id="qs-land"
        sky={MORNING.stops}
        stars={MORNING.stars}
        sun={SUN}
        shapes="define"
        windblown
        truntum
        kawungSun
      />
    </div>
  );
}
