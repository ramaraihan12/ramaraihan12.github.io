import { type ReactNode, useId } from "react";
import { rng } from "@/components/art/rng";
import { project, type Pt, r, VIEW } from "./geometry";
import type { Retrieval } from "./pool";
import { strings as S } from "./strings";

type PosterProps = {
  data: Retrieval;
  /** Notes in a pool and how many to pick, for the stats line. */
  n: number;
  k: number;
  /** The Play button, or whatever should sit in its place. */
  action?: ReactNode;
  className?: string;
};

/*
  The game's cover, drawn like a truntum cloth at night: the notes are the stars on the map,
  the question is a turmeric truntum flower, and three search rings go round it by hand. The
  truntum ground itself is a background in game.css. Pure markup, rendered into the static
  HTML; the drawing below is a few lines, seeded, so the server and the browser agree.
*/

/** Eight petals, long and short in turn, around the centre: truntum's star-flower. */
const FLOWER = (() => {
  let d = "";
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const long = i % 2 === 0;
    const [r0, r1, w] = long ? [5, 24, 6.6] : [5, 15.5, 4.8];
    const mid = (r0 + r1) / 2;
    const [cx, cy] = [Math.cos(a), Math.sin(a)];
    const at = (t: number, side: number) => `${r(cx * t - cy * side)} ${r(cy * t + cx * side)}`;
    d += `M${at(r0, 0)}Q${at(mid, w)} ${at(r1, 0)}Q${at(mid, -w)} ${at(r0, 0)}Z`;
  }
  return d;
})();

/** A ring drawn by hand: a little out of round, and the pen runs past where it started. */
function handRing(c: Pt, radius: number, seed: number) {
  const rand = rng(seed);
  const p1 = rand() * 6.3;
  const p2 = rand() * 6.3;
  const start = rand() * 6.3;
  const steps = 40;
  const sweep = Math.PI * 2 + 0.3;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = start + (sweep * i) / steps;
    const rr = radius * (1 + 0.035 * Math.sin(t + p1) + 0.02 * Math.sin(2 * t + p2)) + (i / steps) * 1.6;
    d += `${i ? "L" : "M"}${r(c.x + Math.cos(t) * rr)} ${r(c.y + Math.sin(t) * rr)}`;
  }
  return d;
}

export function Poster({ data, n, k, action, className }: PosterProps) {
  const proj = project([data.query, ...data.points], 26);
  const q = proj.at(data.query);
  const rings = [38, 76, 118];
  const glow = `${useId().replace(/:/g, "")}-glow`;

  return (
    <div className={className ? `nn-poster ${className}` : "nn-poster"}>
      <svg className="nn-poster-art" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id={glow}>
            <stop offset="0" className="nn-glow-in" />
            <stop offset="1" className="nn-glow-out" />
          </radialGradient>
        </defs>
        {rings.map((radius, i) => (
          <path key={radius} className="nn-poster-ring" data-i={i} d={handRing(q, radius, 11 + i * 7)} />
        ))}
        <g className="nn-poster-dots">
          {data.points.map((p, i) => {
            const at = proj.at(p);
            // Stars of a few sizes, so the field doesn't look like a scatter plot.
            return <circle key={i} cx={r(at.x)} cy={r(at.y)} r={1.5 + ((i * 7) % 5) * 0.32} />;
          })}
        </g>
        <circle cx={r(q.x)} cy={r(q.y)} r={52} fill={`url(#${glow})`} />
        <circle className="nn-query-ping" cx={r(q.x)} cy={r(q.y)} r={9} />
        <g className="nn-poster-flower" transform={`translate(${r(q.x)} ${r(q.y)})`}>
          <path d={FLOWER} />
          <circle r={4.6} />
          <circle className="nn-poster-flower-eye" r={2.1} />
        </g>
      </svg>

      <div className="nn-poster-body">
        <p className="nn-poster-kicker">{S.poster.kicker}</p>
        <p className="nn-poster-question">{data.question}</p>
        <ul className="nn-poster-stats">
          {S.poster.stats(n, k).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        {action}
      </div>
    </div>
  );
}
