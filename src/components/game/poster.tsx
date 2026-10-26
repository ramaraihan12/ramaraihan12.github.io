import { type ReactNode, useId } from "react";
import { dot, nums, petal, type Pt, smooth, taper } from "@/components/art/draw";
import { hash, rng, wobble } from "@/components/art/rng";
import { strings as S } from "./strings";

type PosterProps = {
  /** How many notes the game deals from, for the stats line and the stars. */
  notes: number;
  /** How many questions it asks. */
  questions: number;
  /** The Play button, or whatever should sit in its place. */
  action?: ReactNode;
  className?: string;
};

/*
  The game's cover, on the truntum night the section is drawn on. The question is the turmeric
  truntum flower, the notes are stars, and two of them are tied to the question by hand-drawn
  threads: one pulled taut, one hanging slack. Which is closer is the whole game, and the
  thread says it before any words do. Along the bottom runs the cloth a run weaves, three panels
  dyed (calm, warm, hot: an easy call, a closer one, a near coin toss) and the rest still in
  pencil.

  Pure markup, in the static HTML and the first load, so the drawing is a few seeded lines from
  the art kit's pen (draw.ts), not the batik tiles: the server and the browser draw the same.
*/

const VIEW = { w: 400, h: 280 };
/*
  Both notes sit the same distance from the question on the page, so the eye can't tell which
  is closer. Only the thread can: it's the model's score, not the layout, that pulls.
*/
const Q: Pt = [138, 104];
/** The note the model scores closer: its thread is pulled taut. */
const NEAR: Pt = [290, 60];
/** The other note: its thread hangs. */
const FAR: Pt = [282, 178];
/** The cloth along the bottom: the panel band's top, its height (one tile), and a panel's width. */
const CLOTH = { y: 238, h: 30, w: 30 };

/** Eight petals, long and short in turn, around the centre: truntum's star-flower. */
const FLOWER = (() => {
  let d = "";
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const long = i % 2 === 0;
    const [r0, r1, w] = long ? [5, 24, 6.6] : [5, 15.5, 4.8];
    const mid = (r0 + r1) / 2;
    const [cx, cy] = [Math.cos(a), Math.sin(a)];
    const at = (t: number, side: number) => nums([cx * t - cy * side, cy * t + cx * side]);
    d += `M${at(r0, 0)}Q${at(mid, w)} ${at(r1, 0)}Q${at(mid, -w)} ${at(r0, 0)}Z`;
  }
  return d;
})();

/** A four-pointed star, its sides pinched in toward the middle, like the stars between kawung petals. */
function sparkle([x, y]: Pt, s: number) {
  const tips: Pt[] = [
    [x, y - s],
    [x + s, y],
    [x, y + s],
    [x - s, y],
  ];
  let d = `M${nums(tips[0])}`;
  for (let i = 1; i <= 4; i++) {
    const a = tips[i - 1];
    const b = tips[i % 4];
    d += `Q${nums([x + (a[0] + b[0] - 2 * x) * 0.14, y + (a[1] + b[1] - 2 * y) * 0.14, ...b])}`;
  }
  return `${d}Z`;
}

/** A ring drawn by hand: a little out of round, and the pen runs past where it started. */
function handRing([cx, cy]: Pt, radius: number, seed: number) {
  const r = rng(seed);
  const p1 = r() * 6.3;
  const p2 = r() * 6.3;
  const start = r() * 6.3;
  const points: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = start + ((Math.PI * 2 + 0.35) * i) / 24;
    const rr = radius * (1 + 0.04 * Math.sin(t + p1) + 0.025 * Math.sin(2 * t + p2)) + (i / 24) * 1.2;
    points.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]);
  }
  return smooth(points);
}

/** Where a thread leaves the flower and where it reaches a star: just outside each. */
function ends(a: Pt, b: Pt, ra: number, rb: number): [Pt, Pt] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / len;
  const uy = (b[1] - a[1]) / len;
  return [
    [a[0] + ux * ra, a[1] + uy * ra],
    [b[0] - ux * rb, b[1] - uy * rb],
  ];
}

/*
  The taut thread is near straight and drawn like a canting line, swelling in the middle; the
  slack one is a thinner line that hangs below both its ends before it climbs to the star.
*/
const THREADS = (() => {
  const r = rng(hash("closer threads"));
  const [a, b] = ends(Q, NEAR, 17, 11);
  const taut: Pt[] = [];
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    const edge = i === 0 || i === 5 ? 0 : 0.45;
    taut.push([a[0] + (b[0] - a[0]) * t + wobble(r, edge), a[1] + (b[1] - a[1]) * t + wobble(r, edge)]);
  }
  // A thread hanging between two pins: a curve pulled down by its own weight, lowest a little
  // past the middle since the far end is lower.
  const [c, d] = ends(Q, FAR, 17, 11);
  const pull: Pt = [(c[0] + d[0]) / 2 + 8, (c[1] + d[1]) / 2 + 44];
  const slack: Pt[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const u = 1 - t;
    const edge = i === 0 || i === 10 ? 0 : 0.3;
    slack.push([u * u * c[0] + 2 * u * t * pull[0] + t * t * d[0] + wobble(r, edge), u * u * c[1] + 2 * u * t * pull[1] + t * t * d[1] + wobble(r, edge)]);
  }
  return {
    taut: taper(taut, (t) => 1.1 + 1.3 * Math.sin(Math.PI * t), 12),
    slack: smooth(slack),
  };
})();

/** The rest of the notes, as faint stars, seeded so the sky is the same on every load. */
function sky(count: number) {
  const r = rng(hash("closer sky"));
  const keepOut: [Pt, number][] = [
    [Q, 40],
    [NEAR, 26],
    [FAR, 30],
  ];
  let small = "";
  let big = "";
  let tries = 0;
  let placed = 0;
  while (placed < count && tries < count * 20) {
    tries++;
    const p: Pt = [8 + r() * (VIEW.w - 16), 8 + r() * (CLOTH.y - 26)];
    if (keepOut.some(([c, d]) => Math.hypot(p[0] - c[0], p[1] - c[1]) < d)) continue;
    const s = r();
    if (s > 0.86) big += sparkle(p, 2.6 + r() * 1.2);
    else small += dot(p[0], p[1], 0.7 + s * 0.9);
    placed++;
  }
  return { small, big };
}

/*
  One kawung cell: four petals from the centre toward the corners, the way the motif is built,
  so cells side by side meet in flowers at their corners too. Drawn once, laid as a pattern.
*/
const KAWUNG = (() => {
  const c = CLOTH.h / 2;
  const r = rng(hash("closer kawung"));
  const half = (c * Math.SQRT2) / 4;
  const a = half * 0.86;
  const b = a * 0.62;
  let outer = "";
  let inner = "";
  for (let q = 0; q < 4; q++) {
    const ang = Math.PI / 4 + (q * Math.PI) / 2 + wobble(r, 0.04);
    const px = c / 2 + Math.cos(ang) * half;
    const py = c / 2 + Math.sin(ang) * half;
    outer += petal(px, py, a, b, ang, r, { drift: 0.05, tip: 0.4, digits: 2 });
    inner += petal(px, py, a * 0.5, b * 0.36, ang, r, { drift: 0.08, tip: 0.34, digits: 2 });
  }
  return { size: c, outer, inner, seeds: dot(c / 2, c / 2, 0.75, 2) + dot(0, 0, 0.9, 2) + dot(c, 0, 0.9, 2) + dot(0, c, 0.9, 2) + dot(c, c, 0.9, 2) };
})();

const DYES = ["calm", "warm", "hot"] as const;

export function Poster({ notes, questions, action, className }: PosterProps) {
  const id = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const stars = sky(Math.max(0, Math.min(notes, 64) - 2));
  const cell = `${id}-cell`;
  const band = { y: CLOTH.y, h: CLOTH.h };
  // Dotted seret rows above and below the panels, the cloth's long edges: one line each, its
  // dashes zero long with round caps, so the dots cost a few bytes instead of one path each.
  const cecek = (y: number) => `M3 ${y}H${VIEW.w}`;

  return (
    <div className={className ? `nn-poster ${className}` : "nn-poster"}>
      <svg className="nn-poster-art" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id={`${id}-glow`}>
            <stop offset="0" className="nn-poster-glow-in" />
            <stop offset="1" className="nn-poster-glow-out" />
          </radialGradient>
          <g id={cell}>
            <path className="nn-poster-k-body" d={KAWUNG.outer} />
            <path className="nn-poster-k-line" d={KAWUNG.outer} />
            <path className="nn-poster-k-fine" d={KAWUNG.inner} />
            <path className="nn-poster-k-seed" d={KAWUNG.seeds} />
          </g>
          {[...DYES, "pola" as const].map((dye) => (
            <pattern
              key={dye}
              id={`${id}-${dye}`}
              width={KAWUNG.size}
              height={KAWUNG.size}
              x={0}
              y={band.y}
              patternUnits="userSpaceOnUse"
            >
              <g className="nn-poster-k" data-dye={dye}>
                <rect className="nn-poster-k-ground" width={KAWUNG.size} height={KAWUNG.size} />
                <use href={`#${cell}`} />
              </g>
            </pattern>
          ))}
          <linearGradient id={`${id}-fade`}>
            <stop offset="0.3" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id={`${id}-pola`}>
            <rect width={VIEW.w} height={VIEW.h} fill={`url(#${id}-fade)`} />
          </mask>
        </defs>

        <g className="nn-poster-sky">
          <path d={stars.small} />
          <path className="nn-poster-sky-big" d={stars.big} />
        </g>

        {/* The cloth: blank cotton, its pencil pola fading off, three panels already dyed. */}
        <g className="nn-poster-cloth">
          <rect className="nn-poster-cloth-blank" y={band.y - 9} width={VIEW.w} height={band.h + 18} />
          <rect y={band.y} width={VIEW.w} height={band.h} fill={`url(#${id}-pola)`} mask={`url(#${id}-pola)`} />
          <path className="nn-poster-cecek" d={cecek(band.y - 4.5) + cecek(band.y + band.h + 4.5)} />
          {DYES.map((dye, i) => (
            <rect
              key={dye}
              className="nn-poster-panel"
              x={14 + i * CLOTH.w}
              y={band.y}
              width={CLOTH.w}
              height={band.h}
              fill={`url(#${id}-${dye})`}
            />
          ))}
        </g>

        <path className="nn-poster-thread" data-pull="slack" d={THREADS.slack} />
        <path className="nn-poster-thread" data-pull="taut" d={THREADS.taut} />

        <path className="nn-poster-ring" d={handRing(NEAR, 11, 31)} />
        <path className="nn-poster-ring" data-far="" d={handRing(FAR, 10, 47)} />
        <path className="nn-poster-star" data-near="" d={sparkle(NEAR, 6.5)} />
        <path className="nn-poster-star" d={sparkle(FAR, 5.5)} />

        <circle cx={Q[0]} cy={Q[1]} r={50} fill={`url(#${id}-glow)`} />
        <circle className="nn-poster-ping" cx={Q[0]} cy={Q[1]} r={9} />
        <g className="nn-poster-flower" transform={`translate(${nums(Q)})`}>
          <path d={FLOWER} />
          <circle r={4.6} />
          <circle className="nn-poster-flower-eye" r={2.1} />
        </g>
      </svg>

      <div className="nn-poster-body">
        <p className="nn-poster-kicker">{S.poster.kicker}</p>
        <p className="nn-poster-name">{S.poster.name}</p>
        <ul className="nn-poster-stats">
          {S.poster.stats(notes, questions).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        {action}
      </div>
    </div>
  );
}
