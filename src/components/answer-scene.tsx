import Image from "next/image";
import type { CSSProperties } from "react";
import { Fragment } from "react";
import { BatikFrame } from "@/components/art/batik-frame";
import { Duotone } from "@/components/art/duotone";
import { batikTile } from "@/components/art/files";
import { answerCopy } from "@/content/copy";
import { site } from "@/content/site";
import { answer, retrieval, sourceLinks } from "@/content/story";
import { ArrowUpRightIcon } from "./icons";
import { AnswerStage } from "./scenes/closing/answer-stage";

/*
  The answer, written from the five notes that came back, with citations. A server component:
  the batik and the dyed photo are drawn here, into the HTML. The scroll timeline lives in
  AnswerStage, the one client piece.
*/

const notesUrl = `${site.source}/blob/main/scripts/notes.json`;

/*
  The turmeric flood is a dyed cloth: a kawung ground, its lines in a turmeric a little deeper
  than the page (the "answer-ground" tile in art/files.tsx). Faint on purpose: nila text is
  8.9:1 on kunyit and still 7.5:1 right on a line, the muted text 5.7:1 and 4.8:1.
*/
const groundTile = batikTile("answer-ground");
const ground = {
  "--answer-ground": groundTile.css,
  "--answer-ground-size": `${groundTile.size}px`,
} as CSSProperties;

/** Splits the answer into words, with "[n]" turned into a citation link. */
function AnswerText() {
  const words = answer.replace(/ \[/g, "[").split(" ");
  return words.map((word, i) => (
    <Fragment key={i}>
      {word.split(/(\[\d\])/).map((part, k) => {
        const cite = part.match(/^\[(\d)\]$/);
        if (cite) {
          const n = Number(cite[1]);
          return (
            <sup key={k} className="cite w">
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
      })}{" "}
    </Fragment>
  ));
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
                {/* A head-and-shoulders crop on phones, where the full portrait would be tiny. */}
                <Image
                  src="/images/rama-avatar.jpg"
                  alt={answerCopy.photoSmallAlt}
                  width={384}
                  height={384}
                  sizes="96px"
                  className="answer-photo-small"
                />
                <Image
                  src="/images/rama.jpg"
                  alt={answerCopy.photoLargeAlt}
                  width={900}
                  height={1200}
                  sizes="(min-width: 768px) 320px, 1px"
                  className="answer-photo-large"
                />
              </Duotone>
            </BatikFrame>
          </div>
          <p className="answer-text">
            <AnswerText />
          </p>
        </div>

        <ol className="answer-sources" aria-label={answerCopy.sourcesLabel}>
          {retrieval.top.map((t, rank) => {
            const note = retrieval.points[t.index];
            const href = sourceLinks[note.source];
            return (
              <li key={t.index} id={`source-${rank + 1}`}>
                <span className="answer-source-n">{rank + 1}</span>
                {href ? (
                  <a href={href}>
                    {note.source}
                    <ArrowUpRightIcon className="size-3" />
                  </a>
                ) : (
                  <span>{note.source}</span>
                )}
                <span className="answer-source-score">{t.score.toFixed(3)}</span>
              </li>
            );
          })}
        </ol>

        <p className="answer-note">
          {answerCopy.note} <a href={notesUrl}>{answerCopy.allNotes}</a>
        </p>
      </div>
    </AnswerStage>
  );
}
