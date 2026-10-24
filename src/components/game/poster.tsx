import { type ReactNode, useId } from "react";
import { gridPath, project, r, VIEW } from "./geometry";
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

/**
 * The game's cover: every note on the 2D map, the question in turmeric with search rings
 * around it, and the Play button. Pure markup, rendered into the static HTML, so it costs the
 * first load nothing but a few hundred bytes of SVG.
 */
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
        <path className="nn-grid" d={gridPath(proj)} />
        {rings.map((radius, i) => (
          <circle key={radius} className="nn-poster-ring" data-i={i} cx={r(q.x)} cy={r(q.y)} r={radius} />
        ))}
        <g className="nn-poster-dots">
          {data.points.map((p, i) => {
            const at = proj.at(p);
            return <circle key={i} cx={r(at.x)} cy={r(at.y)} r={2.6} />;
          })}
        </g>
        <circle cx={r(q.x)} cy={r(q.y)} r={44} fill={`url(#${glow})`} />
        <circle className="nn-query-ping" cx={r(q.x)} cy={r(q.y)} r={7} />
        <circle className="nn-query-dot" cx={r(q.x)} cy={r(q.y)} r={6} />
        <text className="nn-poster-q" x={r(q.x + 12)} y={r(q.y - 12)}>
          ?
        </text>
      </svg>

      <div className="nn-poster-body">
        <p className="nn-poster-kicker">{S.poster.kicker}</p>
        <p className="nn-poster-name">{S.poster.name}</p>
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
