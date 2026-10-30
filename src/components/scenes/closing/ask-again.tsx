"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { askAgainCopy } from "@/content/copy";

/*
  The title says "ask me something else", so you can. Ten questions were embedded ahead of time
  (src/content/closer.json, the same file the game draws from) and scored against the 51 notes.
  Picking one lists its three closest notes with those real scores. Nothing is sent anywhere.

  The questions (closer.json, a few KB) load when the section is about to come into view, the
  notes' text (retrieval.json, the larger file) on the first pick. Both are dynamic imports, so
  neither is in the main bundle. closer.json's scores run in the same order as retrieval.json's
  points.
*/

const TOP = 3;

type Hit = { source: string; text: string; score: number };
type Q = { id: string; text: string; scores: number[] };
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

export function AskAgain() {
  const root = useRef<HTMLDivElement>(null);
  const [questions, setQuestions] = useState<Q[] | null>(null);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // The questions come in a screen before the section does.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let live = true;
    const go = () => loadQuestions().then((q) => live && setQuestions(q), () => live && setFailed(true));
    if (!("IntersectionObserver" in window)) {
      go();
      return () => void (live = false);
    }
    const io = new IntersectionObserver(
      (e) => {
        if (e.some((x) => x.isIntersecting)) {
          io.disconnect();
          go();
        }
      },
      { rootMargin: "900px 0px" },
    );
    io.observe(el);
    return () => {
      live = false;
      io.disconnect();
    };
  }, []);

  function warm() {
    loadNotes().then(setNotes, () => {});
  }

  function pick(id: string) {
    setPicked(id);
    setFailed(false);
    loadNotes().then(setNotes, () => setFailed(true));
  }

  const question = questions?.find((q) => q.id === picked);
  const hits = question && notes ? closest(question, notes) : [];

  return (
    <div className="ask" ref={root}>
      <p className="ask-label" id="ask-label">
        {askAgainCopy.label}
      </p>
      <div className="ask-chips" role="group" aria-labelledby="ask-label">
        {questions?.map((q) => (
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

      <div className="ask-out" aria-live="polite">
        {failed && <p className="ask-note">{askAgainCopy.failed}</p>}
        {!failed && picked && !notes && <p className="ask-note">{askAgainCopy.loading}</p>}
        {question && hits.length > 0 && (
          <>
            <p className="sr-only">{askAgainCopy.announce(question.text, hits.length)}</p>
            <p className="ask-head" aria-hidden="true">
              {askAgainCopy.head(hits.length, notes?.length ?? 0)}
            </p>
            <ol className="ask-hits" key={question.id}>
              {hits.map((h, i) => (
                <li key={h.source + i} className="ask-hit" style={{ "--score": h.score, "--i": i } as CSSProperties}>
                  <span className="ask-score">
                    <span className="sr-only">similarity </span>
                    {h.score.toFixed(2)}
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
