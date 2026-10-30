import { batikPatternMarkup } from "./patterns";
import { type Pt, smooth, wavy } from "./draw";
import { rng } from "./rng";

/*
  A layangan, the paper kite every kid in Java has flown off a roof. Flat colours, the site's
  own parang for the skin, a tail of small knots. Drawn once with fixed seeds, so the server and
  the browser agree.

  The drawing is a 100 x 100 box that sits in the bottom right of the sky band (see contact.css).
  Whoever is flying it stands on the near hill at ANCHOR, the string runs up to the kite in a
  shallow sag, and the kite hangs out in the open sky right of the summit.

  Two poses in one drawing, picked by CSS from the sky's phase:
    .layangan-up    flying, the string pulled taut, swaying from the hand
    .layangan-down  laid on the hill with the string slack, for when it's dark
  The colours come from CSS variables so it can read on a night sky.
*/

const r = rng(41);

const ANCHOR: Pt = [22, 92];
const KITE_AT: Pt = [62, 27];

// A diamond a little longer below the crossbar than above, as real ones are. Local coordinates,
// centred on the crossbar, 13 wide and 17 tall.
const TOP: Pt = [0, -8];
const RIGHT: Pt = [6.5, -2];
const BOTTOM: Pt = [0, 9];
const LEFT: Pt = [-6.5, -2];
const OUTLINE = `M${TOP}L${RIGHT}L${BOTTOM}L${LEFT}Z`;

// The string: from the bridle (a little below the crossbar) down to the hand, taut with a slight
// sag. Written in the drawing's own coordinates.
const STRING = `M${ANCHOR}Q40 66 ${KITE_AT[0] - 1.2} ${KITE_AT[1] + 4}`;

// The tail: a ribbon from the bottom tip, drifting off to the side the string isn't on.
const TAIL_SPINE = wavy([0, 9], [3, 31], r, 1.1, 6);
const TAIL = smooth(TAIL_SPINE, false);
const KNOTS = TAIL_SPINE.slice(1, -1);

// The parang tile at about an eighth of its size, so a few blades fit in a thirteen-wide kite.
const PARANG_DAY = batikPatternMarkup("parang", "lg-parang", { scale: 0.14, ink: "var(--soga)", ground: "var(--mori)" });
const PARANG_NIGHT = batikPatternMarkup("parang", "lg-parang-night", { scale: 0.14, ink: "var(--soga-2)", ground: "var(--nila-2)" });

function Kite() {
  return (
    <>
      <path d={TAIL} className="lg-tail" />
      {KNOTS.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="0.6" className="lg-knot" />
      ))}
      <path d={OUTLINE} className="lg-skin" />
      {/* the two sticks, then the outline over the edge of the skin */}
      <path d={`M${TOP}L${BOTTOM}M${LEFT}L${RIGHT}`} className="lg-spar" />
      <path d={OUTLINE} className="lg-edge" />
    </>
  );
}

export function Layangan() {
  return (
    <svg className="layangan" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs dangerouslySetInnerHTML={{ __html: PARANG_DAY + PARANG_NIGHT }} />
      <g className="layangan-up">
        <g className="lg-sway">
          <path d={STRING} className="lg-string" />
          <g transform={`translate(${KITE_AT}) rotate(-12)`}>
            <g className="lg-kite">
              <Kite />
            </g>
          </g>
        </g>
        <circle cx={ANCHOR[0]} cy={ANCHOR[1]} r="0.9" className="lg-hand" />
      </g>
      <g className="layangan-down">
        {/* Slack string pooled on the ground, kite leaning against the hill beside it. */}
        <path d="M22 92C28 90 31 94 38 92S48 91 52 93" className="lg-string" />
        <g transform="translate(40 87) rotate(-68) scale(0.9)">
          <Kite />
        </g>
        <circle cx={ANCHOR[0]} cy={ANCHOR[1]} r="0.9" className="lg-hand" />
      </g>
    </svg>
  );
}
