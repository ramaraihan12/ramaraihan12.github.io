import type { CSSProperties } from "react";
import { Fragment } from "react";
import { BatikFrame } from "@/components/art/batik-frame";
import { dot, num, type Pt, smooth, wavy } from "@/components/art/draw";
import { Duotone } from "@/components/art/duotone";
import { batikTile } from "@/components/art/files";
import { hash, rng, wobble } from "@/components/art/rng";
import { answerCopy } from "@/content/copy";
import { site } from "@/content/site";
import { answer, retrieval, sourceLinks } from "@/content/story";
import { ArrowUpRightIcon } from "./icons";
import { AnswerStage } from "./scenes/closing/answer-stage";

/*
  The answer, written from the five notes that came back, with citations. A server component:
  the batik, the dyed photo and the five notes' wax rings are drawn here, into the HTML. The
  scroll timeline lives in AnswerStage, the one client piece.
*/

const notesUrl = `${site.source}/blob/main/scripts/notes.json`;

/** The five notes, in rank order, with the score that ranked them. */
const top = retrieval.top.map((t, rank) => ({ n: rank + 1, score: t.score, note: retrieval.points[t.index] }));
const scoreOf = (n: number) => top[n - 1]?.score ?? 0;

/*
  The turmeric flood is a dyed cloth: a kawung ground, its lines in a turmeric a little deeper
  than the page (the "answer-ground" tile in art/files.tsx). Faint on purpose: nila text is
  8.9:1 on kunyit and still 7.5:1 right on a line, the muted text 5.7:1 and 4.8:1.

  The cloth ends in a hem, the way a kain does: two lines across, then a row of tumpal, the
  triangles that edge a batik cloth, standing on the last line. Without it the kawung stopped
  in a straight cut above the contact block.
*/
const groundTile = batikTile("answer-ground");
const HEM = { w: 44, h: 30, ink: "#c98912" };

function hemTile() {
  const r = rng(hash("answer-hem"));
  const { w, h, ink } = HEM;
  const line = (y: number, wave: number) => smooth(wavy([0, y], [w, y], r, wave, 3));
  // The tumpal: a triangle standing on the bottom line, a smaller one inside it and a wax dot.
  const tip = (x: number, y: number): Pt => [x + wobble(r, 0.5), y + wobble(r, 0.5)];
  const tri = (inset: number, top: number) => `M${inset} ${h - 1}L${tip(w / 2, top).map((v) => num(v)).join(" ")}L${w - inset} ${h - 1}`;
  const paths = [
    `<path d="${line(1.4, 0.35)}" stroke-width="1.5"/>`,
    `<path d="${line(5, 0.3)}" stroke-width=".8"/>`,
    `<path d="${tri(2, 9.5)}" stroke-width="1.3" stroke-linejoin="round"/>`,
    `<path d="${tri(9, 17.5)}" stroke-width=".8" stroke-linejoin="round"/>`,
    `<path d="${line(h - 1, 0.2)}" stroke-width="1.5"/>`,
    // Half a dot at each side, so two tiles side by side make one between the tumpal.
    `<path d="${dot(w / 2, h - 5.5, 1.3)}${dot(0, 11, 1.2)}${dot(w, 11, 1.2)}" fill="${ink}" stroke="none"/>`,
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" fill="none" stroke="${ink}" stroke-linecap="round">${paths.join("")}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const ground = {
  "--answer-ground": groundTile.css,
  "--answer-ground-size": `${groundTile.size}px`,
  "--answer-hem": hemTile(),
  "--answer-hem-ratio": HEM.w / HEM.h,
} as CSSProperties;

/*
  The five notes come back for the answer, wax-ringed with their rank like on the map above.
  They wait round the query dot in the directions the map had them from the query, then each
  one flies into its citation as the answer reaches it. The ring's line is the note's score:
  the same weight as its citation's box and its number in the source list.

  Directions are on screen (the map's y points up). `far` is where a note drifts in from: the
  note's own direction from the dot and how far out along it (in half screens), so every note
  comes in on its own ray and no two paths cross. `near` is how far from the dot it waits, in
  px at desktop size.
*/
const RING = 9;

function ringPaths(seed: string, rank: number) {
  const r = rng(hash(`answer-ring-${seed}`));
  const ring: Pt[] = Array.from({ length: 14 }, (_, k) => {
    const a = (k / 14) * Math.PI * 2;
    const rr = RING + wobble(r, 0.6);
    return [Math.cos(a) * rr, Math.sin(a) * rr] as const;
  });
  const cecek = Array.from({ length: 10 }, (_, k) => {
    const a = (k / 10) * Math.PI * 2 + rank;
    return dot(Math.cos(a) * (RING + 5), Math.sin(a) * (RING + 5), 1);
  }).join("");
  return { line: smooth(ring, true), core: dot(0, 0, 3.6), cecek };
}

const notes = top.map(({ n, score, note }) => {
  const dx = note.x - retrieval.query.x;
  const dy = -(note.y - retrieval.query.y);
  const d = Math.hypot(dx, dy) || 1;
  const [ux, uy] = [dx / d, dy / d];
  // The fourth note would sit against the second, so it waits a little further out.
  const near = 64 + 150 * d + (note.source === "stack/midtrans" ? 16 : 0);
  return {
    n,
    score,
    source: note.source,
    // The fourth note reads leftwards, away from the second one it would pass on the way in.
    side: ux < -0.2 || note.source === "stack/midtrans" ? "left" : "right",
    near: [ux * near, uy * near],
    far: [ux, uy, 0.4 + 0.5 * d],
    paths: ringPaths(note.source, n - 1),
  };
});

function AnswerNotes() {
  return (
    <div className="answer-notes" aria-hidden="true">
      {notes.map((note) => (
        <span
          key={note.n}
          className="an-note"
          data-side={note.side}
          data-far={note.far.map((v) => v.toFixed(3)).join(" ")}
          style={{ "--gx": note.near[0].toFixed(1), "--gy": note.near[1].toFixed(1) } as CSSProperties}
        >
          <span className="an-drift">
            <span className="an-fly">
              <svg viewBox="-17 -17 34 34" focusable="false">
                <path className="an-ring-line" d={note.paths.line} strokeWidth={(note.score * 4.4).toFixed(2)} vectorEffect="non-scaling-stroke" />
                <path className="an-ring-cecek" d={note.paths.cecek} />
                <path className="an-ring-core" d={note.paths.core} />
              </svg>
              <span className="an-rank">{note.n}</span>
            </span>
            <span className="an-label">
              {note.source} <span className="an-score">{note.score.toFixed(3)}</span>
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}

/** One word, with "[n]" turned into a citation link. */
function Word({ word }: { word: string }) {
  const parts = word.split(/(\[\d\])/).map((part, k) => {
    const cite = part.match(/^\[(\d)\]$/);
    if (cite) {
      const n = Number(cite[1]);
      return (
        <sup key={k} className="cite w" data-note={n} style={{ "--s": scoreOf(n) } as CSSProperties}>
          <a href={`#source-${n}`} aria-label={answerCopy.citeLabel(n)}>
            {n}
          </a>
        </sup>
      );
    }
    return part ? (
      <span key={k} className="w">
        {part}
      </span>
    ) : null;
  });
  // A word with a citation stays in one piece, so "[5]." never wraps onto a line of its own.
  return parts.length > 1 ? <span className="w-cite">{parts}</span> : parts;
}

/**
 * The answer in words, grouped by the citation each stretch leads up to: a citation backs
 * everything since the one before it. So the first sentence goes with [1], since about.md says
 * that too. Hovering or focusing a citation underlines its group.
 */
function AnswerText() {
  const groups: { n: number; words: string[] }[] = [];
  let words: string[] = [];
  for (const word of answer.replace(/ \[/g, "[").split(" ")) {
    words.push(word);
    const cite = word.match(/\[(\d)\]/);
    if (cite) {
      groups.push({ n: Number(cite[1]), words });
      words = [];
    }
  }
  if (words.length) groups.push({ n: 0, words });

  return groups.map((group, g) => {
    const inner = group.words.map((word, i) => (
      <Fragment key={i}>
        {i ? " " : null}
        <Word word={word} />
      </Fragment>
    ));
    return (
      <Fragment key={g}>
        {g ? " " : null}
        {group.n ? (
          <span className="answer-s" data-note={group.n}>
            {inner}
          </span>
        ) : (
          inner
        )}
      </Fragment>
    );
  });
}

export function AnswerScene() {
  return (
    <AnswerStage>
      <div className="answer-bg" aria-hidden="true" style={ground} />
      <div className="answer-inner container-page">
        <p className="answer-eyebrow eyebrow">{answerCopy.eyebrow}</p>
        <h2 id="answer-title" className="sr-only">
          {answerCopy.title}
        </h2>

        <div className="answer-grid">
          <div className="answer-photo">
            {/* Parang in nila, soga and a turmeric wax line, around a photo dyed in the same
                two colors as the page. It comes back to its own colors on hover. */}
            <BatikFrame tile="photo-frame" width="var(--answer-frame-w)" radius="0.5rem">
              <Duotone>
                {/* One small file per screen: the portrait from 48rem up, and on phones a
                    head-and-shoulders crop, where the full portrait would be tiny. Eager at low
                    priority: it comes down with the page without holding up the hero, so it's
                    cached long before the scroll gets here. As a lazy image it only started
                    when the visitor got here, long after the frame around it. */}
                <picture>
                  <source media="(min-width: 48rem)" srcSet="/images/rama.webp" width={640} height={853} />
                  <img
                    src="/images/rama-avatar.webp"
                    alt={answerCopy.photoAlt}
                    width={256}
                    height={256}
                    loading="eager"
                    fetchPriority="low"
                    decoding="async"
                  />
                </picture>
              </Duotone>
            </BatikFrame>
          </div>
          <p className="answer-text">
            <AnswerText />
          </p>
        </div>

        <ol className="answer-sources" aria-label={answerCopy.sourcesLabel}>
          {top.map(({ n, score, note }) => {
            const href = sourceLinks[note.source];
            return (
              <li key={n} id={`source-${n}`} data-note={n} style={{ "--s": score } as CSSProperties}>
                <span className="answer-source-n">{n}</span>
                {href ? (
                  <a href={href} className="answer-source-name">
                    <span className="answer-source-text">{note.source}</span>
                    <ArrowUpRightIcon className="size-3" />
                  </a>
                ) : (
                  <span className="answer-source-name">
                    <span className="answer-source-text">{note.source}</span>
                  </span>
                )}
                <span className="answer-source-score">{score.toFixed(3)}</span>
              </li>
            );
          })}
        </ol>

        <p className="answer-note">
          {answerCopy.note} <a href={notesUrl}>{answerCopy.allNotes}</a>
        </p>
      </div>
      <AnswerNotes />
    </AnswerStage>
  );
}
