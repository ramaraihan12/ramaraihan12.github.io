import { useId, useMemo } from "react";
import { gridPath, project, r, type Pt, VIEW } from "./geometry";
import type { Candidate, Grade, Pool, Retrieval } from "./pool";
import { strings as S } from "./strings";

export type NodeState = "idle" | "picked" | "hit" | "skipped" | "miss" | "decoy";

type Box = { x: number; y: number; w: number; h: number };

const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2)) *
  Math.max(0, Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2));

const outside = (b: Box) =>
  Math.max(0, 3 - (b.x - b.w / 2)) + Math.max(0, b.x + b.w / 2 - (VIEW.w - 3)) +
  Math.max(0, 3 - (b.y - b.h / 2)) + Math.max(0, b.y + b.h / 2 - (VIEW.h - 3));

/**
 * Puts a w by h label next to `anchor`: tries a ring of spots at a few distances and keeps the
 * one that covers the least of what's already placed, preferring close and upper right.
 */
function place(anchor: Pt, w: number, h: number, taken: Box[], gaps = [6, 10, 16]) {
  let best: Box | null = null;
  let bestCost = Infinity;
  gaps.forEach((gap, ring) => {
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI / 4 + (i / 12) * Math.PI * 2;
      const box = {
        x: anchor.x + Math.cos(a) * (gap + w / 2),
        y: anchor.y + Math.sin(a) * (gap + h / 2),
        w,
        h,
      };
      const cost = taken.reduce((sum, t) => sum + overlap(box, t), 0) * 10 + outside(box) * 200 + ring * 4 + i * 0.01;
      if (cost < bestCost) {
        best = box;
        bestCost = cost;
      }
    }
  });
  taken.push(best!);
  return best!;
}

/** Where the ray from `from` to `to` leaves the view, inset by `m`. `to` itself if it's inside. */
function toEdge(from: Pt, to: Pt, m: number): Pt {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let t = 1;
  if (to.x > VIEW.w - m) t = Math.min(t, (VIEW.w - m - from.x) / dx);
  if (to.x < m) t = Math.min(t, (m - from.x) / dx);
  if (to.y > VIEW.h - m) t = Math.min(t, (VIEW.h - m - from.y) / dy);
  if (to.y < m) t = Math.min(t, (m - from.y) / dy);
  return t === 1 ? to : { x: from.x + dx * t, y: from.y + dy * t };
}

type GameMapProps = {
  data: Retrieval;
  pool: Pool;
  /** State of each candidate by its index into data.points. */
  states: Map<number, NodeState>;
  /** Candidate under the pointer or keyboard focus, -1 for none. */
  hot: number;
  revealed: boolean;
  squash: Grade["squash"];
};

/**
 * The notes on the 2D map, zoomed to the pool. Decorative: the cards carry the same content, so
 * the whole SVG is hidden from assistive tech. Every look is a class or a data attribute, so it
 * can be restyled from CSS. The reveal timeline animates `.nn-line` and `.nn-node-pop`.
 */
export function GameMap({ data, pool, states, hot, revealed, squash }: GameMapProps) {
  const uid = useId().replace(/:/g, "");

  const layout = useMemo(() => {
    // Zoom to the neighbourhood: the query, the real matches and anything about as close. A
    // decoy from across the map would squash that into a corner, so it waits at the edge with
    // an arrow pointing the way it really lies.
    const reach = Math.max(...pool.candidates.filter((c) => c.rank >= 0).map((c) => c.mapDistance)) * 1.3;
    const focus = pool.candidates.filter((c) => c.mapDistance <= reach);
    const proj = project([data.query, ...focus.map((c) => data.points[c.index])], 34, 0.55);
    const query = proj.at(data.query);
    const inPool = new Set(pool.candidates.map((c) => c.index));
    const nodes = pool.candidates.map((c) => {
      const real = proj.at(data.points[c.index]);
      const at = toEdge(query, real, 14);
      return { c, at, away: at === real ? null : (Math.atan2(real.y - query.y, real.x - query.x) * 180) / Math.PI };
    });

    // Dots first, so labels steer clear of them. Then the query's label, then the letters.
    const taken: Box[] = [
      { ...query, w: 16, h: 16 },
      ...nodes.map(({ at }) => ({ ...at, w: 10, h: 10 })),
      // The arrows of notes past the edge.
      ...nodes.flatMap(({ at, away }) =>
        away === null ? [] : [{ x: at.x + Math.cos((away * Math.PI) / 180) * 11, y: at.y + Math.sin((away * Math.PI) / 180) * 11, w: 8, h: 8 }],
      ),
    ];
    const queryLabel = place(query, 58, 12, taken, [8, 14]);
    const labels = new Map(nodes.map(({ c, at }) => [c.index, place(at, 10, 12, taken)]));
    const squashAt = squash ? nodes.find((n) => n.c.index === squash.decoy.index)?.at : undefined;
    // The tag only shows with the lines out to the real matches, so it keeps off those too.
    const lines = nodes
      .filter(({ c }) => c.rank >= 0)
      .flatMap(({ at }) =>
        Array.from({ length: 12 }, (_, i) => ({
          x: query.x + ((at.x - query.x) * (i + 0.5)) / 12,
          y: query.y + ((at.y - query.y) * (i + 0.5)) / 12,
          w: 4,
          h: 4,
        })),
      );
    const squashLabel = squashAt ? place(squashAt, 74, 12, [...taken, ...lines], [8, 14, 22]) : null;

    return {
      grid: gridPath(proj),
      query,
      queryLabel,
      labels,
      squashLabel,
      nodes,
      faint: data.points
        .map((p, i) => ({ i, at: proj.at(p) }))
        .filter(({ i, at }) => !inPool.has(i) && at.x > -4 && at.x < VIEW.w + 4 && at.y > -4 && at.y < VIEW.h + 4),
    };
  }, [data, pool, squash]);

  const ranked = layout.nodes.filter((n) => n.c.rank >= 0).sort((a, b) => a.c.rank - b.c.rank);
  const squashNode = squash ? layout.nodes.find((n) => n.c.index === squash.decoy.index) : undefined;
  const { query } = layout;

  return (
    <svg
      className="nn-map"
      viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
      aria-hidden="true"
      focusable="false"
      data-revealed={revealed || undefined}
    >
      <defs>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0" className="nn-glow-in" />
          <stop offset="1" className="nn-glow-out" />
        </radialGradient>
      </defs>

      <path className="nn-grid" d={layout.grid} />

      <g className="nn-faint">
        {layout.faint.map(({ i, at }) => (
          <circle key={i} cx={r(at.x)} cy={r(at.y)} r={1.8} />
        ))}
      </g>

      {revealed ? (
        <g className="nn-lines">
          {squashNode ? (
            <line className="nn-line-squash" x1={r(query.x)} y1={r(query.y)} x2={r(squashNode.at.x)} y2={r(squashNode.at.y)} />
          ) : null}
          {ranked.map(({ c, at }) => (
            <line
              key={c.index}
              className="nn-line"
              data-rank={c.rank}
              pathLength={1}
              x1={r(query.x)}
              y1={r(query.y)}
              x2={r(at.x)}
              y2={r(at.y)}
            />
          ))}
        </g>
      ) : null}

      <circle className="nn-query-glow" cx={r(query.x)} cy={r(query.y)} r={34} fill={`url(#${uid}-glow)`} />
      <circle className="nn-query-ping" cx={r(query.x)} cy={r(query.y)} r={7} />

      {layout.nodes.map(({ c, at, away }) => (
        <Node
          key={c.index}
          c={c}
          at={at}
          away={away}
          label={layout.labels.get(c.index)!}
          state={states.get(c.index) ?? "idle"}
          hot={hot === c.index}
          squash={squash?.decoy.index === c.index}
        />
      ))}

      <circle className="nn-query-dot" cx={r(query.x)} cy={r(query.y)} r={5.5} />
      <text className="nn-query-label" x={r(layout.queryLabel.x)} y={r(layout.queryLabel.y)}>
        {S.map.query}
      </text>

      {revealed && layout.squashLabel ? (
        <text className="nn-squash-tag" x={r(layout.squashLabel.x)} y={r(layout.squashLabel.y)}>
          {S.map.looksClose}
        </text>
      ) : null}
    </svg>
  );
}

type NodeProps = {
  c: Candidate;
  at: Pt;
  /** Direction in degrees when the note lies beyond the edge of the view, else null. */
  away: number | null;
  label: Box;
  state: NodeState;
  hot: boolean;
  squash: boolean;
};

function Node({ c, at, away, label, state, hot, squash }: NodeProps) {
  return (
    <g
      className="nn-node"
      data-index={c.index}
      data-state={state}
      data-rank={c.rank >= 0 ? c.rank : undefined}
      data-hot={hot || undefined}
      data-squash={squash || undefined}
      data-away={away === null ? undefined : ""}
    >
      <circle className="nn-node-pop" cx={r(at.x)} cy={r(at.y)} r={4} />
      <circle className="nn-node-ring" cx={r(at.x)} cy={r(at.y)} r={7.5} />
      {away === null ? null : (
        <path className="nn-node-away" d="M9 -3.2 L14 0 L9 3.2 Z" transform={`translate(${r(at.x)} ${r(at.y)}) rotate(${Math.round(away)})`} />
      )}
      <circle className="nn-node-dot" cx={r(at.x)} cy={r(at.y)} r={3.4} />
      <text className="nn-node-label" x={r(label.x)} y={r(label.y)}>
        {c.letter}
      </text>
    </g>
  );
}
