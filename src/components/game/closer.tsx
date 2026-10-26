"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
} from "react";
import { BATIK_KINDS, CapStamp } from "@/components/art";
import closer from "@/content/closer.json";
import retrieval from "@/content/retrieval.json";
import { REDUCE_MQ, scrollToY } from "@/lib/scroll";
import { goToStage } from "@/lib/stage";
import { Cloth, type Motif } from "./cloth";
import { burst } from "./confetti";
import { type CloserData, createRun, isRight, type NoteRef, type Pair, type Side, QUESTION_EVERY, STREAK_GOAL } from "./rounds";
import { strings as S } from "./strings";

gsap.registerPlugin(useGSAP);

/** localStorage key for the best streak. */
export const BEST_KEY = "rr:closer:best";
/** Seconds a right call stays up, long enough to read both scores. Any tap or key skips it. */
const BEAT = 1.35;
/** A wrong call gets a moment to land before the result takes over. Skippable too. */
const LAST_BEAT = 1.1;
/** With a fixed seed, each Play again steps it, so a replay isn't the same deal. */
const SEED_STEP = 7919;
/** Scores closer than this get the "barely split them" line. */
const CLOSE_CALL = 0.02;

export type CloserResult = { streak: number; best: number };

export type CloserProps = {
  /** The questions and their real scores. Defaults to closer.json. */
  data?: CloserData;
  /** The notes the scores point into. Defaults to retrieval.json's points. */
  points?: readonly NoteRef[];
  /** Seed of the first run. Unset, every run gets a random one. */
  seed?: number;
  /** Moves focus to the question on mount. On by default, since the game replaces the Play button. */
  autoFocus?: boolean;
  /** Called once per run, when the result shows. */
  onFinish?: (result: CloserResult) => void;
  className?: string;
};

type Phase = "pick" | "reveal" | "over";

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const reduced = () => matchMedia(REDUCE_MQ).matches;
const fmt = (score: number) => score.toFixed(3);

function readBest(): number | null {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeBest(n: number) {
  try {
    window.localStorage.setItem(BEST_KEY, String(n));
  } catch {
    // Private mode or blocked storage. The game still works, it just forgets.
  }
}

/** Another part of the site listens for these and hands out achievements. */
const achieve = (id: "game-finished" | "game-perfect") =>
  window.dispatchEvent(new CustomEvent("rr:achieve", { detail: { id } }));

/**
 * Scrolls the least it takes to show el between the fixed header and the bottom of the screen,
 * keeping its top in view if it's taller than that. Returns whether it scrolled.
 */
function reveal(el: Element | null, gap = 16) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const top = (document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0) + gap;
  const bottom = window.innerHeight - gap;
  let by = 0;
  if (rect.bottom > bottom) by = rect.bottom - bottom;
  if (rect.top - by < top) by = rect.top - top;
  if (Math.abs(by) < 2) return false;
  scrollToY(window.scrollY + by);
  return true;
}

/** Whether any of el is on screen, so the game only pulls the page along while it's being watched. */
function onScreen(el: Element | null) {
  const box = el?.getBoundingClientRect();
  return !!box && box.bottom > 0 && box.top < window.innerHeight;
}

/**
 * Counts a text node up from zero to `to`, which React has already rendered into it. If the
 * tween is ever reverted, the node gets its final text back rather than the zero it started at.
 */
function countUp(tl: gsap.core.Timeline, node: ChildNode | null | undefined, to: number, digits: number, at: number) {
  if (!node) return;
  const final = to.toFixed(digits);
  const counter = { v: 0 };
  node.nodeValue = (0).toFixed(digits);
  tl.to(
    counter,
    {
      v: to,
      duration: 0.55,
      ease: "power2.out",
      onUpdate() {
        node.nodeValue = this.progress() > 0 ? counter.v.toFixed(digits) : final;
      },
    },
    at,
  );
}

/** Types a text node out a letter at a time, like the opening question. Reverted, it's whole again. */
function typeOut(tl: gsap.core.Timeline, node: ChildNode | null | undefined, at: number) {
  if (!node?.nodeValue) return;
  const text = node.nodeValue;
  const counter = { n: 0 };
  node.nodeValue = "";
  tl.to(
    counter,
    {
      n: text.length,
      duration: Math.min(0.85, text.length * 0.026),
      ease: "none",
      onUpdate() {
        node.nodeValue = this.progress() > 0 ? text.slice(0, Math.round(counter.n)) : text;
      },
    },
    at,
  );
}

/** Which side a key picks. Up and down only count when the cards are stacked, so they still scroll otherwise. */
function sideFor(key: string, cards: HTMLElement[]): Side | null {
  if (key === "1" || key === "ArrowLeft") return 0;
  if (key === "2" || key === "ArrowRight") return 1;
  if (key !== "ArrowUp" && key !== "ArrowDown") return null;
  const [a, b] = cards.map((c) => c.getBoundingClientRect());
  if (!a || !b || b.top < a.bottom - 1) return null;
  return key === "ArrowUp" ? 0 : 1;
}

/** Keys that never skip: modifiers on their own, and Tab, which is for moving around. */
const PASSIVE = new Set(["Tab", "Shift", "Control", "Alt", "Meta", "CapsLock", "Escape"]);

/** The honest bit for the result: why the model went the other way on the last pair. */
function whyLine(pair: Pair) {
  const win = fmt(pair.scores[pair.answer]);
  const lose = fmt(pair.scores[1 - pair.answer]);
  if (pair.trap) return S.over.why.trap(pair.trap.words, win, lose);
  if (pair.gap < CLOSE_CALL) return S.over.why.close(win, lose);
  return S.over.why.plain(win, lose);
}

/**
 * Closer: one question, two of my notes, and the player picks the one the embedding model
 * scores closer to it. A right call adds to the streak and a motif to the cloth; the first
 * wrong one ends the run. The pairs get closer as the streak grows, and the question changes
 * every few pairs. Never starts on its own; it's mounted when someone presses Play.
 */
export function Closer({ data = closer, points = retrieval.points, seed, autoFocus = true, onFinish, className }: CloserProps) {
  const uid = useId();
  const root = useRef<HTMLDivElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const prompt = useRef<HTMLDivElement>(null);
  const resultHead = useRef<HTMLHeadingElement>(null);
  const hudBits = useRef<HTMLSpanElement>(null);
  /** The phase as of the last handler, so a timer and a tap can't both move the game on. */
  const phaseRef = useRef<Phase>("pick");
  const focusCard = useRef(false);

  const [game, setGame] = useState(() => {
    const run = createRun(data, points, seed ?? randomSeed());
    return { id: 0, run, pair: run.next(), onQuestion: 1 };
  });
  const [phase, setPhase] = useState<Phase>("pick");
  const [pick, setPick] = useState<Side | null>(null);
  const [streak, setStreak] = useState(0);
  const [motifs, setMotifs] = useState<Motif[]>([]);
  const [bestBefore, setBestBefore] = useState(readBest);
  const [said, setSaid] = useState({ text: "", n: 0 });

  const { pair } = game;
  const revealed = phase !== "pick";
  const right = pick !== null && isRight(pair, pick);
  const best = Math.max(bestBefore ?? 0, streak);
  const newBest = bestBefore !== null && streak > bestBefore;
  const sum = pair.scores[0] + pair.scores[1];
  // The split bar: each side gets its share of the two scores, kept off the very ends.
  const share = Math.min(0.96, Math.max(0.04, sum > 0 ? pair.scores[0] / sum : 0.5));

  // Repeating the same sentence wouldn't be read out again, so every message changes the text.
  const announce = (text: string) => setSaid((s) => ({ text, n: s.n + 1 }));

  useEffect(() => {
    if (!autoFocus) return;
    prompt.current?.focus({ preventScroll: true });
    // The whole game if it fits, cloth and all; if not, reveal() keeps the question in view.
    reveal(root.current);
  }, [autoFocus]);

  // A new pair keeps the cards on screen; Play again also hands focus to the first card.
  useEffect(() => {
    if (focusCard.current) {
      focusCard.current = false;
      board.current?.querySelector<HTMLElement>(".cl-card")?.focus({ preventScroll: true });
      reveal(board.current);
    } else if (pair.round > 0 && onScreen(board.current)) {
      reveal(board.current);
    }
  }, [pair]);

  function choose(side: Side) {
    if (phaseRef.current !== "pick") return;
    phaseRef.current = "reveal";
    const win = fmt(pair.scores[pair.answer]);
    const lose = fmt(pair.scores[1 - pair.answer]);
    setPick(side);
    setPhase("reveal");
    if (!isRight(pair, side)) {
      announce(S.announce.wrong(win, lose));
      return;
    }
    const n = streak + 1;
    setStreak(n);
    setMotifs((m) => [...m, { kind: BATIK_KINDS[pair.question.index % BATIK_KINDS.length], heat: pair.heat }]);
    // Saved as it goes, so leaving mid-run still keeps the record.
    if (n > best) writeBest(n);
    if (n === STREAK_GOAL) {
      achieve("game-perfect");
      announce(`${S.announce.right(win, lose, n)} ${S.announce.goal(n)}`);
      // Out of the streak counter, as the stamp lands. Outside the reveal's timeline, so the
      // next pair coming in doesn't cut it short.
      if (!reduced()) gsap.delayedCall(0.4, () => hudBits.current && burst(hudBits.current, 24));
    } else {
      announce(S.announce.right(win, lose, n));
    }
  }

  function advance() {
    if (phaseRef.current !== "reveal") return;
    phaseRef.current = "pick";
    const next = game.run.next();
    setGame((g) => ({ ...g, pair: next, onQuestion: next.fresh ? 1 : g.onQuestion + 1 }));
    setPick(null);
    setPhase("pick");
    if (next.fresh) announce(S.announce.newQuestion(next.question.text));
  }

  function finish() {
    if (phaseRef.current !== "reveal") return;
    phaseRef.current = "over";
    const top = Math.max(readBest() ?? 0, streak);
    writeBest(top);
    setPhase("over");
    achieve("game-finished");
    onFinish?.({ streak, best: top });
  }

  /** Cuts the beat short: on to the next pair, or to the result. */
  function skip() {
    if (phaseRef.current !== "reveal") return;
    if (right) advance();
    else finish();
  }

  function again() {
    const run = createRun(data, points, seed === undefined ? randomSeed() : seed + (game.id + 1) * SEED_STEP);
    const first = run.next();
    phaseRef.current = "pick";
    focusCard.current = true;
    setGame({ id: game.id + 1, run, pair: first, onQuestion: 1 });
    setPhase("pick");
    setPick(null);
    setStreak(0);
    setMotifs([]);
    setBestBefore(readBest());
    announce(S.announce.start(first.question.text));
  }

  function toAnswer(e: MouseEvent) {
    // The answer is a pinned scene, so its stage marker knows where it reads best.
    if (goToStage("answer")) e.preventDefault();
  }

  // Keys only while focus is in the game, so the page keeps its own keys everywhere else.
  function onKeys(e: KeyboardEvent<HTMLDivElement>) {
    if (phaseRef.current === "over" || e.altKey || e.ctrlKey || e.metaKey) return;
    if (phaseRef.current === "reveal") {
      if (PASSIVE.has(e.key)) return;
      // Also stops Enter or Space from clicking the focused card, which would pick in the next pair.
      e.preventDefault();
      if (!e.repeat) skip();
      return;
    }
    const cards = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(".cl-card"));
    const side = sideFor(e.key, cards);
    if (side === null) return;
    e.preventDefault();
    if (e.repeat) return;
    cards[side]?.focus({ preventScroll: true });
    choose(side);
  }

  const onBeat = useEffectEvent(() => skip());
  useEffect(() => {
    if (phase !== "reveal") return;
    const timer = window.setTimeout(onBeat, (right ? BEAT : LAST_BEAT) * 1000);
    return () => window.clearTimeout(timer);
  }, [phase, right, pair]);

  // A new pair: the cards slide in from the side (from below when stacked), and a new question
  // types itself out like the one at the top of the page.
  useGSAP(
    () => {
      if (reduced()) return;
      const el = root.current!;
      const cards = gsap.utils.toArray<HTMLElement>(".cl-card", el);
      const [a, b] = cards.map((c) => c.getBoundingClientRect());
      const stacked = !!a && !!b && b.top >= a.bottom - 1;
      const tl = gsap.timeline();
      tl.fromTo(
        cards,
        { opacity: 0, x: stacked ? 0 : 36, y: stacked ? 18 : 0 },
        { opacity: 1, x: 0, y: 0, duration: 0.34, ease: "power3.out", stagger: 0.06, clearProps: "opacity" },
      );
      // The typed copy is keyed by question, so a new one is a fresh node with a fresh caret.
      if (pair.fresh) typeOut(tl, el.querySelector(".cl-q-type")?.firstChild, 0);
    },
    { scope: root, dependencies: [game.id, pair.round], revertOnUpdate: true },
  );

  // The reveal: the picked card gives under the press, both scores count up, the bar splits,
  // and the cap lands on the closer note. A wrong pick shakes and takes a soga mark.
  useGSAP(
    () => {
      if (!revealed || pick === null || reduced()) return;
      const el = root.current!;
      const card = (side: number) => el.querySelector<HTMLElement>(`.cl-card[data-side="${side}"]`);
      const tl = gsap.timeline();
      tl.fromTo(card(pick), { scale: 0.96 }, { scale: 1, duration: 0.4, ease: "back.out(3)" }, 0);
      countUp(tl, card(0)?.querySelector(".cl-score-n")?.firstChild, pair.scores[0], 3, 0.05);
      countUp(tl, card(1)?.querySelector(".cl-score-n")?.firstChild, pair.scores[1], 3, 0.05);
      // --split is the bar's own value; React sets the target as --split-to, which it falls back to.
      tl.fromTo(el.querySelector(".cl-tug"), { "--split": 0.5 }, { "--split": share, duration: 0.6, ease: "power3.out" }, 0.05);
      const press = (sel: string, at: number) =>
        tl.call(() => el.querySelectorAll<HTMLElement>(sel).forEach((s) => (s.dataset.state = "pressed")), [], at);
      press(".cl-stamp-win", 0.42);
      if (right) {
        tl.fromTo(el.querySelector(".cl-streak-n"), { scale: 1.6 }, { scale: 1, duration: 0.5, ease: "back.out(3)" }, 0.45);
      } else {
        tl.to(card(pick), { keyframes: { x: [0, -7, 6, -4, 2, 0] }, duration: 0.42, ease: "none" }, 0.5);
        press(".cl-stamp-pick", 0.62);
      }
    },
    // Not phase: going on to the result has to keep the finished reveal, not rewind it.
    { scope: root, dependencies: [revealed, game.id, pair.round], revertOnUpdate: true },
  );

  // The result: focus moves to it, the streak counts up, and a record of five or more gets confetti.
  useGSAP(
    () => {
      if (phase !== "over") return;
      const el = root.current!;
      resultHead.current?.focus({ preventScroll: true });
      // Only pull the result into view if they're still looking at the game.
      if (onScreen(el)) reveal(el.querySelector(".cl-result"));
      if (reduced()) return;
      const tl = gsap.timeline();
      tl.fromTo(".cl-result", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }).fromTo(
        ".cl-result-body > *, .cl-result-best",
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.35, stagger: 0.07, ease: "power2.out" },
        0.12,
      );
      if (streak > 0) countUp(tl, el.querySelector(".cl-result-n")?.firstChild, streak, 0, 0.05);
      const host = el.querySelector<HTMLElement>(".cl-result .cl-confetti");
      if (host && streak >= 5 && (bestBefore === null || streak > bestBefore)) tl.add(burst(host), 0.45);
      return () => host?.replaceChildren();
    },
    { scope: root, dependencies: [phase, game.id], revertOnUpdate: true },
  );

  const card = (side: Side) => {
    const note = points[pair.notes[side]];
    const win = side === pair.answer;
    const picked = side === pick;
    const motion = !reduced();
    return (
      <button
        type="button"
        className="cl-card"
        data-side={side}
        data-state={revealed ? (win ? "win" : "lose") : "idle"}
        data-picked={(revealed && picked) || undefined}
        aria-disabled={revealed || undefined}
        aria-keyshortcuts={side === 0 ? "1 ArrowLeft" : "2 ArrowRight"}
        onClick={(e) => {
          // After the pick a click goes on up to the game, where it skips the beat.
          if (phaseRef.current !== "pick") return;
          e.stopPropagation();
          choose(side);
        }}
      >
        <span className="cl-card-head">
          <span className="cl-card-key" aria-hidden="true">
            {side + 1}
          </span>
          <span className="cl-card-src">{note.source}</span>
        </span>
        <span className="cl-card-text">{note.text}</span>
        <span className="cl-card-foot">
          <span className="cl-score" aria-hidden={!revealed || undefined}>
            <span className="cl-score-label">{S.game.scoreLabel}</span>{" "}
            <span className="cl-score-n">{revealed ? fmt(pair.scores[side]) : S.game.hidden}</span>
          </span>
          {revealed && win ? (
            <CapStamp className="cl-stamp cl-stamp-win" state={motion ? "ready" : "stamped"} seed={`closer-${pair.round}`}>
              {S.game.stampCloser}
            </CapStamp>
          ) : null}
          {revealed && picked && !win ? (
            <CapStamp className="cl-stamp cl-stamp-pick" ink="var(--soga-2)" shape="round" state={motion ? "ready" : "stamped"} seed={`pick-${pair.round}`}>
              {S.game.stampPick}
            </CapStamp>
          ) : null}
        </span>
      </button>
    );
  };


  return (
    <div
      ref={root}
      className={className ? `cl-game ${className}` : "cl-game"}
      data-phase={phase}
      data-right={revealed ? right : undefined}
      onKeyDown={onKeys}
      onClick={() => phaseRef.current === "reveal" && skip()}
    >
      <div ref={board} className="cl-board">
        <div className="cl-head">
          <div ref={prompt} className="cl-prompt" tabIndex={-1}>
            <p className="cl-label">
              <span>{S.game.questionLabel}</span>
              <span className="cl-label-pair">{S.game.pairOf(game.onQuestion, QUESTION_EVERY)}</span>
              {pair.fresh && pair.round > 0 && phase === "pick" ? <span className="cl-tag">{S.game.newQuestion}</span> : null}
            </p>
            <p className="cl-q">
              <span className="cl-q-text">{pair.question.text}</span>
              {/* What types out on screen. The text above is what's read, and holds the space. */}
              <span key={`${game.id}-${pair.question.id}`} className="cl-q-type" aria-hidden="true">
                {pair.question.text}
              </span>
            </p>
            <p className="cl-how">{S.game.how}</p>
          </div>

          <div className="cl-hud">
            <p className="cl-streak">
              <span className="cl-streak-n">{streak}</span>
              <span className="cl-streak-label">{S.game.streak}</span>
              <span ref={hudBits} className="cl-confetti" aria-hidden="true" />
            </p>
            {best > 0 ? <p className="cl-best">{S.game.best(best)}</p> : null}
          </div>
        </div>

        <div className="cl-arena" role="group" aria-label={S.game.notesLabel}>
          {card(0)}
          <div
            className="cl-tug"
            aria-hidden="true"
            data-win={revealed ? pair.answer : undefined}
            style={{ "--split-to": revealed ? share : 0.5 } as CSSProperties}
          >
            <span className="cl-tug-side" data-side="0" />
            <span className="cl-tug-side" data-side="1" />
            <span className="cl-tug-knot" />
          </div>
          {card(1)}
        </div>
      </div>

      <div className="cl-foot" data-over={phase === "over" || undefined}>
        <div className="cl-cloth-slot">
          <Cloth motifs={motifs} final={phase === "over"} className="cl-cloth" />
          {motifs.length === 0 && phase !== "over" ? (
            <p className="cl-cloth-empty" aria-hidden="true">
              {S.game.clothEmpty}
            </p>
          ) : null}
        </div>

        {phase === "over" ? (
          <Result
            id={`${uid}-result`}
            headRef={resultHead}
            streak={streak}
            best={best}
            newBest={newBest}
            goal={streak >= STREAK_GOAL}
            line={S.over.line(streak, STREAK_GOAL, data.dims)}
            why={whyLine(pair)}
            onAgain={again}
            onAnswer={toAnswer}
          />
        ) : (
          // Both versions are in the page; the stylesheet shows the one for the device in hand.
          <p className="cl-hint" aria-hidden="true">
            {phase === "reveal" && right ? (
              <>
                {S.game.gap(fmt(pair.gap))} <span className="cl-hint-touch">{S.game.skipTouch}</span>
                <span className="cl-hint-keys">{S.game.skip}</span>
              </>
            ) : (
              <>
                <span className="cl-hint-touch">{S.game.touch}</span>
                <span className="cl-hint-keys">{S.game.keys}</span>
              </>
            )}
          </p>
        )}
      </div>

      <p className="sr-only" role="status">
        {said.text}
        {said.n % 2 ? " " : ""}
      </p>
    </div>
  );
}

type ResultProps = {
  id: string;
  headRef: RefObject<HTMLHeadingElement | null>;
  streak: number;
  best: number;
  newBest: boolean;
  goal: boolean;
  line: string;
  why: string;
  onAgain: () => void;
  onAnswer: (e: MouseEvent) => void;
};

function Result({ id, headRef, streak, best, newBest, goal, line, why, onAgain, onAnswer }: ResultProps) {
  return (
    <div className="cl-result" role="group" aria-labelledby={id} data-goal={goal || undefined}>
      <div className="cl-result-score">
        <h3 id={id} ref={headRef} tabIndex={-1} className="cl-result-head">
          <span className="sr-only">{S.over.head(streak)}</span>
          <span className="cl-result-n" aria-hidden="true">
            {streak}
          </span>
          <span className="cl-confetti" aria-hidden="true" />
        </h3>
        <div className="cl-result-meta">
          <p className="cl-result-label" aria-hidden="true">
            {S.over.streakLabel(streak)}
          </p>
          <p className="cl-result-best">
            <span>{S.over.best(best)}</span>
            {newBest ? <span className="cl-tag">{S.over.newBest}</span> : null}
          </p>
        </div>
      </div>
      <div className="cl-result-body">
        <p className="cl-result-line">{line}</p>
        <p className="cl-result-why">{why}</p>
        <div className="cl-result-actions">
          <button type="button" className="nn-btn nn-btn-solid" onClick={onAgain}>
            {S.over.again}
          </button>
          <a href="#answer" className="nn-btn nn-btn-line" onClick={onAnswer}>
            {S.over.answer} <span aria-hidden="true">↓</span>
          </a>
        </div>
      </div>
    </div>
  );
}
