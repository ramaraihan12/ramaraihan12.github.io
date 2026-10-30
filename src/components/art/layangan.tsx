import { type Pt, smooth, wavy } from "./draw";
import { rng } from "./rng";

/*
  A layangan, the paper kite every kid in Java has flown off a roof. Flat colours, a parang skin
  (the diagonal blade motif, here as slanting bands with a dot in each) and a tail of small
  knots. Drawn once with fixed seeds, so the server and the browser agree.

  Two poses in one drawing, picked by CSS from the sky's phase (see contact.css):
    .layangan-up    high on a long string, swaying
    .layangan-down  laid against the hill with the string slack, for when it's dark and the
                    kite has been brought in
  The colours come from CSS variables so the string can read on a night sky.
*/

const r = rng(41);

// The kite: a diamond a little longer below the crossbar than above, as real ones are.
const TOP: Pt = [50, 6];
const RIGHT: Pt = [80, 38];
const BOTTOM: Pt = [50, 92];
const LEFT: Pt = [20, 38];
const OUTLINE = `M${TOP}L${RIGHT}L${BOTTOM}L${LEFT}Z`;

// The string from the bridle down to the hand: a long slow S.
const STRING = smooth([[44, 66], [38, 100], [58, 150], [44, 200], [56, 250]], false);

// The tail: a ribbon with knots, hanging from the bottom tip.
const TAIL_SPINE = wavy([50, 92], [56, 150], r, 5, 5);
const TAIL = smooth(TAIL_SPINE, false);
const KNOTS = TAIL_SPINE.slice(1).map(([x, y], i) => ({ x, y, w: 6 - i * 0.6 }));

// Parang bands: slanting S-curves across the kite, drawn wider than it and clipped to it.
const BANDS = [-30, -14, 2, 18, 34, 50, 66].map((dy, i) => {
  const y0 = 20 + dy;
  return smooth(
    [
      [14, y0 + 14],
      [32, y0 + 2 + (i % 2) * 2],
      [50, y0 - 6],
      [68, y0 - 12 - (i % 2) * 2],
      [86, y0 - 22],
    ],
    false,
  );
});
const DOTS: Pt[] = [[34, 44], [52, 34], [66, 56], [44, 66], [58, 16], [38, 24]];

function Kite() {
  return (
    <>
      <path d={TAIL} className="lg-tail" />
      {KNOTS.map((k, i) => (
        <path key={i} d={`M${k.x - k.w / 2} ${k.y - 1.6}L${k.x + k.w / 2} ${k.y + 1.6}M${k.x + k.w / 2} ${k.y - 1.6}L${k.x - k.w / 2} ${k.y + 1.6}`} className="lg-tail" />
      ))}
      <path d={OUTLINE} className="lg-paper" />
      <g clipPath="url(#lg-clip)">
        {BANDS.map((d, i) => (
          <path key={i} d={d} className="lg-band" />
        ))}
        {DOTS.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.7" className="lg-dot" />
        ))}
      </g>
      {/* the two sticks, then the outline over the edge of the skin */}
      <path d={`M${TOP}L${BOTTOM}M${LEFT}L${RIGHT}`} className="lg-spar" />
      <path d={OUTLINE} className="lg-edge" />
    </>
  );
}

export function Layangan() {
  return (
    <svg className="layangan" viewBox="0 0 100 250" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="lg-clip">
          <path d={OUTLINE} />
        </clipPath>
      </defs>
      <g className="layangan-up">
        <path d={STRING} className="lg-string" />
        <g className="lg-kite">
          <Kite />
        </g>
      </g>
      <g className="layangan-down">
        {/* Slack string pooled on the ground, kite leaning on it. */}
        <path d="M44 246C30 240 22 248 36 249C54 252 74 244 90 248" className="lg-string" />
        <g transform="translate(26 168) rotate(-64 50 50) scale(0.8)">
          <Kite />
        </g>
      </g>
    </svg>
  );
}
