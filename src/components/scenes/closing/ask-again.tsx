"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { askAgainCopy } from "@/content/copy";
import { scrollToY } from "@/lib/scroll";

/*
  The title says "ask me something else", so you can. Ten questions were embedded ahead of time
  (src/content/closer.json, the same file the game draws from) and scored against the 51 notes.
  Picking one lists its three closest notes with those real scores. Nothing is sent anywhere.

  The chips are drawn on the server from the questions' text alone (contact.tsx passes it in),
  so they are there from the first paint and the section never grows after the page has been
  placed on a reload. The scores and the notes' text are dynamic imports that start on the first
  hover, focus or pick. closer.json's scores run in the same order as retrieval.json's points.
*/

const TOP = 3;

type Hit = { source: string; text: string; score: number };
type Q = { id: string; text: string; scores: number[] };
type Chip = { id: string; text: string };
type Note = { source: string; text: string };

let qLoad: Promise<Q[]> | null = null;
function loadQuestions() {
  qLoad ??= import("@/content/closer.json").then((m) => m.default.questions).catch((e) => ((qLoad = null), Promise.reject(e)));
  return qLoad;
}
let nLoad: Promise<Note[]> | null = null;
function loadNotes() {
  nLoad ??= import("@/content/retrieval.json").then((m) => m.default.points).catch((e) => ((nLoad = null), Promise.reject(e)));
  return nLoad;
}

function closest(q: Q, notes: Note[]): Hit[] {
  return q.scores
    .map((score, i) => ({ score, i }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, TOP)
    .map(({ score, i }) => ({ source: notes[i].source, text: notes[i].text, score }));
}

export function AskAgain({ questions: chips }: { questions: Chip[] }) {
  const [questions, setQuestions] = useState<Q[] | null>(null);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const head = useRef<HTMLParagraphElement>(null);
  const asked = useRef(false);

  function warm() {
    loadQuestions().then(setQuestions, () => {});
    loadNotes().then(setNotes, () => {});
  }

  function pick(id: string) {
    asked.current = true;
    setPicked(id);
    setFailed(false);
    Promise.all([loadQuestions(), loadNotes()]).then(
      ([q, n]) => {
        setQuestions(q);
        setNotes(n);
      },
      () => setFailed(true),
    );
  }

  const question = questions?.find((q) => q.id === picked);
  const hits = question && notes ? closest(question, notes) : [];

  // On a phone the chips stack tall and the answer lands below the fold; bring it up. Only after
  // a pick, never on mount.
  useEffect(() => {
    const el = head.current;
    if (!asked.current || !el || !hits.length) return;
    const top = el.getBoundingClientRect().top;
    if (top > window.innerHeight - 140) scrollToY(window.scrollY + top - window.innerHeight * 0.35);
  }, [picked, hits.length]);

  return (
    <div className="ask">
      <p className="ask-label" id="ask-label">
        {askAgainCopy.label}
      </p>
      <div className="ask-chips" role="group" aria-labelledby="ask-label">
        {chips.map((q) => (
          <button
            key={q.id}
            type="button"
            className="ask-chip"
            aria-pressed={picked === q.id}
            onClick={() => pick(q.id)}
            onPointerEnter={warm}
            onFocus={warm}
          >
            {q.text}
          </button>
        ))}
      </div>

      <p className="sr-only" role="status">
        {failed
          ? askAgainCopy.failed
          : picked && !hits.length
            ? askAgainCopy.loading
            : question && hits.length > 0
              ? askAgainCopy.announce(question.text, hits.length)
              : ""}
      </p>
      <div className="ask-out">
        {failed && <p className="ask-note">{askAgainCopy.failed}</p>}
        {!failed && picked && !hits.length && <p className="ask-note">{askAgainCopy.loading}</p>}
        {question && hits.length > 0 && (
          <>
            <p className="ask-head" ref={head} aria-hidden="true">
              {askAgainCopy.head(hits.length, notes?.length ?? 0)}
            </p>
            <ol className="ask-hits" key={question.id}>
              {hits.map((h, i) => (
                <li key={h.source + i} className="ask-hit" style={{ "--score": h.score, "--i": i } as CSSProperties}>
                  <span className="ask-score">
                    <span className="sr-only">similarity </span>
                    {h.score.toFixed(3)}
                  </span>
                  <span className="ask-src">{h.source}</span>
                  <span className="ask-text">{h.text}</span>
                  <span className="ask-bar" aria-hidden="true" />
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
