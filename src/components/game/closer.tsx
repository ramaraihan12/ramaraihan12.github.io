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
/**
 * A wrong call gets longer: the shake and the soga stamp land at about 0.9s, and the player
 * needs a moment with both scores before the result takes over. Skippable too.
 */
const LAST_BEAT = 1.7;
/**
 * Milliseconds a tap or key is ignored after a pick or a new pair, so the second click of a
 * double click can't skip the scores it just revealed, or pick blind in the pair after.
 */
const SETTLE = 350;
/** With a fixed seed, each Play again steps it, so a replay isn't the same deal. */
const SEED_STEP = 7919;
/**
 * Scores closer than this get the "barely split them" line. The deal never goes much under
 * 0.02 (rounds.ts), so this is about as close as a run gets.
 */
const CLOSE_CALL = 0.05;

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
/** For SETTLE: a moment `ms` from now, and whether a moment has come. */
const later = (ms: number) => performance.now() + ms;
const reached = (moment: number) => performance.now() >= moment;

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

type Edges = { top?: number; bottom?: number };

/**
 * Where the page has to scroll, starting from `from`, to show el between the fixed header and
 * the bottom of the screen with the least movement, keeping its top in view if it's taller than
 * that. `clear` moves either edge in, to keep el out from under something else that's fixed.
 */
function aim(el: Element, from = window.scrollY, gap = 16, clear: Edges = {}) {
  const header = document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0;
  const top = Math.max(header, clear.top ?? 0) + gap;
  const bottom = Math.min(window.innerHeight, clear.bottom ?? Infinity) - gap;
  // Where el would sit on screen with the page at `from`.
  const rect = el.getBoundingClientRect();
  const shift = window.scrollY - from;
  let by = 0;
  if (rect.bottom + shift > bottom) by = rect.bottom + shift - bottom;
  if (rect.top + shift - by < top) by = rect.top + shift - top;
  return from + by;
}

/** Scrolls to show el (see aim). Returns where to, or null if it was in view already. */
function reveal(el: Element | null) {
  if (!el) return null;
  const y = aim(el);
  if (Math.abs(y - window.scrollY) < 2) return null;
  scrollToY(y);
  return y;
}

/** Whether any of el is on screen, so the game only pulls the page along while it's being watched. */
function onScreen(el: Element | null) {
  const box = el?.getBoundingClientRect();
  return !!box && box.bottom > 0 && box.top < window.innerHeight;
}

/** How long scrollToY takes to get somewhere (lib/scroll.ts), and a little more. */
const SCROLL_TIME = 1500;

/**
 * Achievement cards turn up a moment after the result: bottom left on a wide screen, right over
 * the big number and Play again, or under the header on a narrow one. Each one that lands on
 * the result moves it clear, for as long as the result is up. `headed` is where the page was
 * sent to show the result, since it may still be on its way. A card's offset box is where it
 * settles, without the slide it comes in on. Returns a cleanup.
 */
function dodgeToasts(result: HTMLElement | null, headed: number) {
  const arriving = performance.now() + SCROLL_TIME;
  let seen: Element | null = null;
  const check = () => {
    const toast = document.querySelector<HTMLElement>(".rr-toast");
    if (!toast || toast === seen || !result) return;
    seen = toast;
    // Where the page is, or is about to be, and where the result sits on screen there.
    const from = performance.now() < arriving ? headed : window.scrollY;
    const box = result.getBoundingClientRect();
    const shift = window.scrollY - from;
    const [top, left] = [toast.offsetTop, toast.offsetLeft];
    const [bottom, right] = [top + toast.offsetHeight, left + toast.offsetWidth];
    if (right <= box.left || left >= box.right || bottom <= box.top + shift || top >= box.bottom + shift) return;
    const y = aim(result, from, 16, top > window.innerHeight / 2 ? { bottom: top } : { top: bottom });
    if (Math.abs(y - from) >= 2) scrollToY(y);
  };
  check();
  const watch = new MutationObserver(check);
  watch.observe(document.body, { childList: true, subtree: true });
  return () => watch.disconnect();
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
  if (pair.gap < CLOSE_CALL) return S.over.why.close(win, lose, fmt(pair.gap));
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
  const owesFinished = useRef(false);
  /** performance.now() until which taps and keys are ignored. See SETTLE. */
  const settleUntil = useRef(0);
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

  // Scrolling away from the result counts as leaving it.
  useEffect(() => {
    const el = root.current;
    if (phase !== "over" || !el) return;
    const watch = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting || !owesFinished.current) return;
      owesFinished.current = false;
      achieve("game-finished");
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, [phase]);

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

  /** Whether a tap or key is still too close on the heels of the last pick or pair to count. */
  const settling = () => !reached(settleUntil.current);
  const settle = () => (settleUntil.current = later(SETTLE));

  function choose(side: Side) {
    if (phaseRef.current !== "pick" || settling()) return;
    phaseRef.current = "reveal";
    settle();
    const win = fmt(pair.scores[pair.answer]);
    const lose = fmt(pair.scores[1 - pair.answer]);
    setPick(side);
    setPhase("reveal");
    // On a short screen, a phone on its side, the feet of long cards can sit under the fold
    // while they're read. The scores and the stamp are the point of the reveal, so they come
    // up; the next pair brings the question back. Nothing moves when they're on screen already.
    const arena = board.current?.querySelector(".cl-arena") ?? null;
    if (onScreen(arena)) reveal(arena);
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
    settle();
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
    // The card would land on the result it is explaining, so it waits until they leave it.
    owesFinished.current = true;
    onFinish?.({ streak, best: top });
  }

  /** Cuts the beat short: on to the next pair, or to the result. */
  function skip() {
    if (phaseRef.current !== "reveal" || settling()) return;
    if (right) advance();
    else finish();
  }

  /** Hands out the "first run" card, once the player has left the result. */
  function flushFinished() {
    if (!owesFinished.current) return;
    owesFinished.current = false;
    achieve("game-finished");
  }

  function again() {
    flushFinished();
    const run = createRun(data, points, seed === undefined ? randomSeed() : seed + (game.id + 1) * SEED_STEP);
    const first = run.next();
    phaseRef.current = "pick";
    settle();
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
    flushFinished();
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
        tl.fromTo(el.querySelector(".cl-streak-n"), { scale: 1.45 }, { scale: 1, duration: 0.5, ease: "back.out(3)" }, 0.45);
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
      const result = el.querySelector<HTMLElement>(".cl-result");
      const headed = (onScreen(el) ? reveal(result) : null) ?? window.scrollY;
      const undodge = dodgeToasts(result, headed);
      if (reduced()) return undodge;
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
      return () => {
        undodge();
        host?.replaceChildren();
      };
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
          <Cloth motifs={motifs} final={phase === "over"} />
          {motifs.length === 0 && phase !== "over" ? (
            <p className="cl-cloth-empty" aria-hidden="true">
              <span>{S.game.clothEmpty}</span>
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
            motifs={motifs}
            onAgain={again}
            onAnswer={toAnswer}
          />
        ) : (
          // Both versions are in the page; the stylesheet shows the one for the device in hand.
          <p className="cl-hint" aria-hidden="true">
            {phase === "reveal" ? (
              <>
                {S.game.gap(fmt(pair.gap))} <span className="cl-hint-touch">{right ? S.game.skipTouch : S.game.endTouch}</span>
                <span className="cl-hint-keys">{right ? S.game.skip : S.game.end}</span>
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
  motifs: readonly Motif[];
  onAgain: () => void;
  onAnswer: (e: MouseEvent) => void;
};

function SaveCloth({ motifs, streak, best }: { motifs: readonly Motif[]; streak: number; best: number }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "shared" | "failed" | "ready">("idle");
  const timer = useRef(0);
  const file = useRef<File | null>(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const settle = (next: typeof state) => {
    setState(next);
    window.clearTimeout(timer.current);
    if (next !== "idle" && next !== "ready") timer.current = window.setTimeout(() => setState("idle"), 2600);
  };

  // Fetch the drawing code when a finger or the keyboard gets near, so the tap itself waits less.
  const warm = () => void import("./cloth-export");

  async function save() {
    if (state === "busy") return;
    try {
      if (file.current) {
        // The picture is already made: ask for the share sheet straight away, while the tap is fresh.
        const f = file.current;
        const { shareFile } = await import("./cloth-export");
        const r = await shareFile(f);
        if (r === "blocked") return;
        file.current = null;
        settle(r === "shared" ? "shared" : "idle");
        return;
      }
      setState("busy");
      const { saveCloth } = await import("./cloth-export");
      const r = await saveCloth({ motifs, streak, best });
      if (r.result === "ready") {
        file.current = r.file;
        settle("ready");
      } else {
        settle(r.result === "saved" ? "done" : r.result === "shared" ? "shared" : "idle");
      }
    } catch {
      settle("failed");
    }
  }

  const labels = { idle: S.save.button, busy: S.save.busy, done: S.save.done, shared: S.save.shared, failed: S.save.failed, ready: S.save.share };
  const label = labels[state];
  const other = state !== "idle";
  return (
    <>
      <button
        type="button"
        className="nn-btn nn-btn-line cl-save"
        aria-disabled={state === "busy" || undefined}
        onClick={save}
        onPointerDown={warm}
        onFocus={warm}
      >
        {/* Both labels share one box, so the buttons beside it don't move when the words change. */}
        <span aria-hidden={other || undefined} style={other ? { visibility: "hidden" } : undefined}>
          {S.save.button}
        </span>
        {other ? <span>{label}</span> : null}
      </button>
      <span className="sr-only" role="status">
        {other ? label : ""}
      </span>
    </>
  );
}

function Result({ id, headRef, streak, best, newBest, goal, line, why, motifs, onAgain, onAnswer }: ResultProps) {
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
          {streak > 0 && motifs.length > 0 ? <SaveCloth motifs={motifs} streak={streak} best={best} /> : null}
          <a href="#answer" className="nn-btn nn-btn-line" onClick={onAnswer}>
            {S.over.answer} <span aria-hidden="true">↓</span>
          </a>
        </div>
      </div>
    </div>
  );
}
