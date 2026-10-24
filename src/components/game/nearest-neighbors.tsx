"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import retrieval from "@/content/retrieval.json";
import { REDUCE_MQ, scrollToY } from "@/lib/scroll";
import { goToStage } from "@/lib/stage";
import { burst } from "./confetti";
import { GameMap, type NodeState } from "./game-map";
import { buildPool, type Candidate, grade, type Grade, type Retrieval } from "./pool";
import { strings as S } from "./strings";

gsap.registerPlugin(useGSAP);

/** localStorage key for the best score, stored as the number of real matches found. */
export const BEST_KEY = "rr:nn:best";
/** Seed of the first pool, so everyone starts with the same deal. Each new round steps it. */
export const DEFAULT_SEED = 1;
export const DEFAULT_DECOYS = 7;
const SEED_STEP = 7919;

export type GameResult = {
  seed: number;
  hits: number;
  k: number;
  precision: number;
  perfect: boolean;
  /** Indexes into data.points, in the order they were picked. */
  picked: number[];
};

export type NearestNeighborsProps = {
  /** Defaults to the real retrieval data. */
  data?: Retrieval;
  /** Seed of the first pool. */
  seed?: number;
  /** How many decoys are dealt in with the real top results. */
  decoys?: number;
  /** Moves focus to the question on mount. On by default, since the game replaces the Play button. */
  autoFocus?: boolean;
  /** Called once per finished round, when the result shows. */
  onFinish?: (result: GameResult) => void;
  className?: string;
};

type Phase = "pick" | "reveal" | "done";

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

function stateOf(c: Candidate, picked: boolean, revealed: boolean): NodeState {
  if (!revealed) return picked ? "picked" : "idle";
  if (c.rank >= 0) return picked ? "hit" : "skipped";
  return picked ? "miss" : "decoy";
}

const ARROWS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"]);

/** The card next to `from` in the direction of the arrow, by where the cards sit on screen. */
function neighbour(cards: HTMLElement[], from: number, key: string) {
  if (key === "Home") return 0;
  if (key === "End") return cards.length - 1;
  if (key === "ArrowLeft") return Math.max(0, from - 1);
  if (key === "ArrowRight") return Math.min(cards.length - 1, from + 1);
  const a = cards[from].getBoundingClientRect();
  const down = key === "ArrowDown";
  let best = from;
  let bestD = Infinity;
  cards.forEach((card, i) => {
    const b = card.getBoundingClientRect();
    const dy = down ? b.top - a.bottom : a.top - b.bottom;
    if (i === from || dy < -1) return;
    const d = dy * 4 + Math.abs(b.left + b.width / 2 - (a.left + a.width / 2));
    if (d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

/**
 * Nearest Neighbors: the player gets the question and a shuffled pool of notes, and picks the
 * ones they think the model retrieved. Then the real top results light up with their scores.
 * Never starts on its own; it's mounted when someone presses Play.
 */
export function NearestNeighbors({
  data = retrieval,
  seed = DEFAULT_SEED,
  decoys = DEFAULT_DECOYS,
  autoFocus = true,
  onFinish,
  className,
}: NearestNeighborsProps) {
  const uid = useId();
  const root = useRef<HTMLDivElement>(null);
  const prompt = useRef<HTMLDivElement>(null);
  const mapBox = useRef<HTMLDivElement>(null);
  const resultHead = useRef<HTMLHeadingElement>(null);
  const cardList = useRef<HTMLUListElement>(null);
  const finishedRound = useRef(-1);
  const focusFirstCard = useRef(false);
  const leadIn = useRef(0);

  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>("pick");
  const [hot, setHot] = useState(-1);
  const [best, setBest] = useState(readBest);
  const [newBest, setNewBest] = useState(false);
  const [said, setSaid] = useState({ text: "", n: 0 });
  const [nudge, setNudge] = useState(0);

  const roundSeed = seed + round * SEED_STEP;
  const pool = useMemo(() => buildPool(data, roundSeed, decoys), [data, roundSeed, decoys]);
  const k = pool.k;
  const revealed = phase !== "pick";
  const chosen = useMemo(() => new Set(picked), [picked]);
  const result = useMemo(() => (revealed ? grade(pool, picked) : null), [revealed, pool, picked]);
  const states = useMemo(
    () => new Map(pool.candidates.map((c) => [c.index, stateOf(c, chosen.has(c.index), revealed)])),
    [pool, chosen, revealed],
  );

  // Repeating the same sentence wouldn't be read out again, so every message changes the text.
  const announce = (text: string) => setSaid((s) => ({ text, n: s.n + 1 }));

  useEffect(() => {
    if (!autoFocus) return;
    prompt.current?.focus({ preventScroll: true });
    reveal(prompt.current);
  }, [autoFocus]);

  useEffect(() => {
    if (!focusFirstCard.current) return;
    focusFirstCard.current = false;
    // The new pool has a new map, so keep that on screen rather than scrolling to the card.
    cardList.current?.querySelector<HTMLElement>(".nn-card")?.focus({ preventScroll: true });
    reveal(mapBox.current);
  }, [round]);

  function toggle(index: number) {
    if (revealed) return;
    if (chosen.has(index)) {
      setPicked(picked.filter((i) => i !== index));
    } else if (picked.length >= k) {
      announce(S.game.full(k));
      setNudge((n) => n + 1);
    } else {
      setPicked([...picked, index]);
    }
  }

  function check() {
    if (revealed) return;
    if (picked.length < k) {
      announce(S.game.checkEarly(k - picked.length));
      setNudge((n) => n + 1);
      return;
    }
    const g = grade(pool, picked);
    const record = best === null || g.hits > best;
    if (record) {
      writeBest(g.hits);
      setBest(g.hits);
    }
    // The first game is always a record, which isn't news.
    setNewBest(record && best !== null);
    setHot(-1);
    announce(`${S.result.announce(g.hits, k, g.precision.toFixed(2))} ${S.result.line(g.hits, k, data.dims)}`);
    const reduce = matchMedia(REDUCE_MQ).matches;
    // On phones the map has usually scrolled away by now. Bring it back so the lines are seen.
    leadIn.current = reveal(mapBox.current) && !reduce ? 0.55 : 0;
    setPhase(reduce ? "done" : "reveal");
  }

  function again() {
    focusFirstCard.current = true;
    setRound((r) => r + 1);
    setPicked([]);
    setPhase("pick");
    setNewBest(false);
    setHot(-1);
    announce(S.game.start(pool.candidates.length, k));
  }

  function toAnswer(e: MouseEvent) {
    // The answer is a pinned scene, so its stage marker knows where it reads best.
    if (goToStage("answer")) e.preventDefault();
  }

  function onCardKeys(e: KeyboardEvent<HTMLUListElement>) {
    if (!ARROWS.has(e.key)) return;
    const cards = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(".nn-card"));
    const from = cards.indexOf(document.activeElement as HTMLElement);
    if (from < 0) return;
    // Only while a card has focus, so the page keeps its own arrow keys everywhere else.
    e.preventDefault();
    cards[neighbour(cards, from, e.key)].focus();
  }

  // The reveal: one line out to each real match in rank order, its card lighting up with the
  // score counting in, then the picks that missed and the decoy that fooled the map.
  useGSAP(
    () => {
      if (phase !== "reveal") return;
      const el = root.current!;
      const one = (sel: string) => el.querySelector<HTMLElement>(sel);
      const all = (sel: string) => gsap.utils.toArray<HTMLElement>(sel, el);
      const step = 0.32;
      const tl = gsap.timeline({ delay: leadIn.current, onComplete: () => setPhase("done") });

      for (const c of pool.candidates) {
        if (c.rank < 0) continue;
        const at = c.rank * step;
        const card = one(`.nn-card[data-index="${c.index}"]`);
        const node = one(`.nn-node[data-index="${c.index}"]`);
        tl.fromTo(one(`.nn-line[data-rank="${c.rank}"]`), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.45, ease: "power2.inOut" }, at)
          .fromTo(node, { "--lit": 0 }, { "--lit": 1, duration: 0.25 }, at + 0.38)
          .fromTo(node?.querySelector(".nn-node-pop") ?? [], { attr: { r: 4 }, opacity: 0.9 }, { attr: { r: 20 }, opacity: 0, duration: 0.7, ease: "power2.out" }, at + 0.38)
          .fromTo(card, { "--lit": 0 }, { "--lit": 1, duration: 0.35, ease: "power1.out" }, at + 0.4)
          .fromTo(card?.querySelector(".nn-verdict") ?? [], { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }, at + 0.4);
        if (c.score !== null) countUp(tl, card?.querySelector(".nn-verdict-num")?.firstChild, c.score, 3, at + 0.4);
      }

      const after = k * step + 0.35;
      const rest = '.nn-card[data-state="miss"], .nn-card[data-state="decoy"]';
      tl.fromTo(all(rest), { "--fade": 0 }, { "--fade": 1, duration: 0.4, stagger: 0.03 }, after)
        .fromTo(all('.nn-card[data-state="miss"] .nn-verdict, .nn-card[data-state="decoy"] .nn-verdict'), { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.03 }, after)
        .fromTo(all('.nn-node[data-state="miss"], .nn-node[data-state="decoy"]'), { "--fade": 0 }, { "--fade": 1, duration: 0.4 }, after)
        .fromTo(all(".nn-line-squash, .nn-squash-tag"), { opacity: 0 }, { opacity: 1, duration: 0.45 }, after + 0.25)
        .to({}, { duration: 0.25 });
    },
    // Not phase: moving on to "done" has to keep the finished reveal, not rewind it.
    { scope: root, dependencies: [revealed, round], revertOnUpdate: true },
  );

  // The result: focus moves to it, the score counts up, and a perfect round gets confetti.
  useGSAP(
    () => {
      if (phase !== "done" || !result) return;
      const el = root.current!;
      resultHead.current?.focus({ preventScroll: true });
      // Only pull the result into view if they're still looking at the game.
      const box = el.getBoundingClientRect();
      if (box.bottom > 0 && box.top < window.innerHeight) reveal(el.querySelector(".nn-result"));

      if (finishedRound.current !== round) {
        finishedRound.current = round;
        achieve("game-finished");
        if (result.perfect) achieve("game-perfect");
        onFinish?.({ seed: roundSeed, hits: result.hits, k, precision: result.precision, perfect: result.perfect, picked });
      }

      if (matchMedia(REDUCE_MQ).matches) return;
      const tl = gsap.timeline();
      tl.fromTo(".nn-result", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }).fromTo(
        ".nn-result-metric, .nn-result-body > *",
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.35, stagger: 0.07, ease: "power2.out" },
        0.12,
      );
      if (result.hits > 0) countUp(tl, el.querySelector(".nn-result-hits")?.firstChild, result.hits, 0, 0.05);
      const host = el.querySelector<HTMLElement>(".nn-confetti");
      if (result.perfect && host) tl.add(burst(host), 0.45);
    },
    { scope: root, dependencies: [phase, round], revertOnUpdate: true },
  );

  return (
    <div ref={root} className={className ? `nn-game ${className}` : "nn-game"} data-phase={phase}>
      <div className="nn-side">
        <div ref={prompt} className="nn-prompt" tabIndex={-1}>
          <p className="nn-prompt-label">{S.game.questionLabel}</p>
          <p className="nn-prompt-q">{data.question}</p>
          <p className="nn-prompt-how">{S.game.instruction(k)}</p>
        </div>

        <div ref={mapBox} className="nn-mapbox">
          <GameMap data={data} pool={pool} states={states} hot={hot} revealed={revealed} squash={result?.squash ?? null} />
          <p className="nn-legend" aria-hidden="true">
            <span className="nn-key nn-key-query">{S.map.legendQuery}</span>
            <span className="nn-key nn-key-pick">{S.map.legendPick}</span>
            <span className="nn-key nn-key-top">{S.map.legendTop(k)}</span>
            <span className="nn-legend-note">{S.map.caption(data.dims)}</span>
          </p>
        </div>

        {phase === "done" && result ? (
          <Result
            id={`${uid}-result`}
            headRef={resultHead}
            result={result}
            dims={data.dims}
            newBest={newBest}
            onAgain={again}
            onAnswer={toAnswer}
          />
        ) : null}
      </div>

      <ul ref={cardList} className="nn-cards" aria-label={S.game.cardsLabel} onKeyDown={onCardKeys}>
        {pool.candidates.map((c) => {
          const note = data.points[c.index];
          const isPicked = chosen.has(c.index);
          return (
            <li key={`${round}-${c.index}`}>
              <button
                type="button"
                className="nn-card"
                aria-pressed={isPicked}
                aria-disabled={revealed || undefined}
                data-state={states.get(c.index)}
                data-index={c.index}
                data-hot={hot === c.index || undefined}
                onClick={() => toggle(c.index)}
                onFocus={() => setHot(c.index)}
                onBlur={() => setHot(-1)}
                onPointerEnter={(e) => e.pointerType === "mouse" && setHot(c.index)}
                onPointerLeave={(e) => e.pointerType === "mouse" && setHot(-1)}
              >
                <span className="nn-card-head">
                  <span className="nn-card-letter">{c.letter}</span>
                  <span className="nn-card-src">{note.source}</span>
                  <span className="nn-card-tick" aria-hidden="true" />
                </span>
                <span className="nn-card-text">{note.text}</span>
                {revealed ? <Verdict c={c} group={note.group} picked={isPicked} k={k} /> : null}
              </button>
            </li>
          );
        })}
      </ul>

      {phase !== "done" ? (
        <div className="nn-dock">
          <p key={nudge} className="nn-count" data-nudge={nudge > 0 || undefined}>
            <span className="nn-pips" aria-hidden="true">
              {pool.candidates.slice(0, k).map((_, i) => (
                <span key={i} className="nn-pip" data-on={i < picked.length || undefined} />
              ))}
            </span>
            <span className="nn-count-text">{S.game.counter(picked.length, k)}</span>
            {best !== null ? <span className="nn-best">{S.game.best(best, k)}</span> : null}
          </p>
          <button
            type="button"
            className="nn-btn nn-btn-solid nn-check"
            aria-disabled={picked.length < k || revealed || undefined}
            data-ready={(picked.length === k && !revealed) || undefined}
            onClick={check}
          >
            {revealed ? S.game.checking : picked.length < k ? S.game.needMore(k - picked.length) : S.game.check(k)}
          </button>
        </div>
      ) : null}

      <p className="sr-only" role="status">
        {said.text}
        {said.n % 2 ? " " : ""}
      </p>
    </div>
  );
}

function Verdict({ c, group, picked, k }: { c: Candidate; group: string; picked: boolean; k: number }) {
  if (c.score !== null) {
    return (
      <span className="nn-verdict" style={{ "--s": c.score } as CSSProperties}>
        <span className="nn-verdict-line">
          <span className="nn-verdict-rank">{S.verdict.rank(c.rank + 1)}</span>
          <span className="nn-verdict-score">
            <span className="sr-only">{S.verdict.scoreLabel} </span>
            <span className="nn-verdict-num">{c.score.toFixed(3)}</span>
          </span>
          <span className="nn-verdict-note">{picked ? S.verdict.found : S.verdict.skipped}</span>
        </span>
        <span className="nn-verdict-bar" aria-hidden="true" />
      </span>
    );
  }
  const trap =
    c.trap === "near"
      ? S.verdict.trap.near
      : c.trap === "words"
        ? S.verdict.trap.words(c.shared)
        : c.trap === "group"
          ? S.verdict.trap.group(group)
          : S.verdict.trap.plain;
  return (
    <span className="nn-verdict">
      <span className="nn-verdict-line">
        {picked ? <span className="nn-verdict-note">{S.verdict.miss(k)}</span> : null}
        <span className="nn-verdict-trap">{trap}</span>
      </span>
    </span>
  );
}

type ResultProps = {
  id: string;
  headRef: RefObject<HTMLHeadingElement | null>;
  result: Grade;
  dims: number;
  newBest: boolean;
  onAgain: () => void;
  onAnswer: (e: MouseEvent) => void;
};

function Result({ id, headRef, result, dims, newBest, onAgain, onAnswer }: ResultProps) {
  const { hits, k, precision, squash } = result;
  return (
    <div className="nn-result" role="group" aria-labelledby={id} data-perfect={result.perfect || undefined}>
      <div className="nn-result-top">
        <h3 id={id} ref={headRef} tabIndex={-1} className="nn-result-head">
          <span className="sr-only">{S.result.score(hits, k)}</span>
          <span className="nn-result-score" aria-hidden="true">
            <span className="nn-result-hits">{hits}</span>
            <span className="nn-result-k">/{k}</span>
          </span>
          <span className="nn-confetti" aria-hidden="true" />
        </h3>
        <p className="nn-result-metric">
          <span>{S.result.metricLabel(k)}</span> <span className="nn-result-p">{precision.toFixed(2)}</span>
          {newBest ? <span className="nn-tag">{S.result.newBest}</span> : null}
        </p>
      </div>
      <div className="nn-result-body">
        <p className="nn-result-line">{S.result.line(hits, k, dims)}</p>
        <p className="nn-result-squash">
          {squash ? S.result.squash(squash.decoy.letter, squash.hit.letter, dims) : S.result.squashPlain(dims)}
        </p>
        <div className="nn-result-actions">
          <button type="button" className="nn-btn nn-btn-solid" onClick={onAgain}>
            {S.result.again}
          </button>
          <a href="#answer" className="nn-btn nn-btn-line" onClick={onAnswer}>
            {S.result.answer} <span aria-hidden="true">↓</span>
          </a>
        </div>
      </div>
    </div>
  );
}
