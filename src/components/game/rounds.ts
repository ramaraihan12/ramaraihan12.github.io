/*
  The rules of Closer, with no React and no DOM, so they're easy to reason about. Each round
  shows one question and two notes, and the player picks the note the embedding model scores
  closer to the question. The scores are read from closer.json (cosine similarity between each
  question and each note in the full embedding), so the rounds still deal fairly when the notes
  are embedded again.

  A run has no fixed length: one wrong pick ends it. So pairs are dealt one at a time, each
  from what the run has already shown, and from a seed, so the same seed always deals the same
  run. The UI makes a seed per run and calls next() once per pair.
*/

/** closer.json: every question scored against every note. scores[i] belongs to points[i]. */
export type CloserData = { model: string; dims: number; questions: { id: string; text: string; scores: number[] }[] };

/** retrieval.json points have these (plus x, y). scores[i] belongs to points[i]. */
export type NoteRef = { source: string; text: string; group: string };

/** 0 is the first card (left, or top on a phone), 1 the second. */
export type Side = 0 | 1;

export type Pair = {
  /** 0-based, and equal to the streak before this pick. */
  round: number;
  question: { index: number; id: string; text: string };
  /** The question differs from the previous pair's (true on round 0). */
  fresh: boolean;
  /** Indexes into points, in the order the cards are shown. */
  notes: [number, number];
  scores: [number, number];
  /** The side with the higher score. */
  answer: Side;
  /** |scores[0] - scores[1]| */
  gap: number;
  /** 0..1, where 1 is the closest call. */
  heat: number;
  /** The lower-scoring side shares these meaningful words with the question, and the higher shares none. */
  trap: { side: Side; words: string[] } | null;
};

export type Run = { seed: number; next(): Pair };

/** How many pairs each question stays for. */
export const QUESTION_EVERY = 3;

/** The streak that counts as beating the game (and fires game-perfect). */
export const STREAK_GOAL = 10;

/**
 * The smallest gap dealt while anything else is left. Below this the model is splitting hairs,
 * and a call that close is a coin toss, not a read.
 */
export const GAP_FLOOR = 0.015;

/** Keyword traps are dealt on purpose from this round on. */
export const TRAP_FROM = 3;

export type Band = { from: number; min: number; max: number };

/**
 * The score gaps each stretch of the streak is dealt from. The last band whose `from` the
 * round has reached applies. The bands overlap, so the step between them isn't a cliff.
 */
export const BANDS: readonly Band[] = [
  { from: 0, min: 0.12, max: Infinity },
  { from: 3, min: 0.07, max: 0.15 },
  { from: 6, min: 0.04, max: 0.09 },
  { from: 10, min: 0.02, max: 0.05 },
];

export function bandFor(round: number): Band {
  let band = BANDS[0];
  for (const b of BANDS) if (round >= b.from) band = b;
  return band;
}

/** How often a trap is dealt on purpose once they start, when the band has one. */
const TRAP_RATE = 1 / 3;

/** The gap at which heat reaches 0. Anything wider is an easy call. */
const HEAT_SPAN = 0.2;

/** Small seeded PRNG (mulberry32), the same one the art kit uses. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(rand: () => number, list: T[]) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Lowercase word tokens (\p{L}\p{N}), like pool.ts `words`. */
export function words(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/*
  Words that say nothing about what a note is about. The question words and pronouns go, and so
  do "rama" and "raihan": every note is mine, so my name is never a real lure. The odd letters
  are what's left of contractions once they're split ("i'm" is "i" and "m").
*/
const STOPWORDS = new Set(
  (
    "a about after all also am an and any are as at be been but by can could did do does doing done " +
    "for from get got had has have having he her him his how i if in into is it its just like ll m " +
    "me more most my no not of on one or our out over re rama raihan s so some such t than that the " +
    "their them then there these they this those to up us use used uses using ve was we were what " +
    "when where which who whom why will with would you your d"
  ).split(" "),
);

/** The meaningful words of a text, once each: stopwords and single letters removed. */
export function keywords(text: string): string[] {
  return [...new Set(words(text))].filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/** One way to pair two notes under one question, lower score first. */
type Option = {
  lo: number;
  hi: number;
  gap: number;
  /** Words the lower note shares with the question, when the higher one shares none. */
  lure: string[] | null;
  /** How much this pair is wanted before the run's own history is counted. */
  weight: number;
};

type Deck = { index: number; id: string; text: string; options: Option[] };

/** One step of loosening the rules: the gaps allowed, whether both notes must be new since the last pair, whether a pair may come back. */
type Stage = { min: number; max: number; apart: boolean; again: boolean };

const pairKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

/*
  Every pair of notes a question can deal, with the weights that don't depend on the run:
  - Two notes from different groups (or at least different files) read less alike, so the
    player compares ideas, not wording.
  - A pair whose better note is one of the question's real matches is a fair read. Two notes
    that both miss the question by a mile, 0.03 apart, are noise to a person, so those are
    dealt less, though not never.
*/
function buildDeck(data: CloserData, points: readonly NoteRef[], index: number): Deck {
  const q = data.questions[index];
  const scores = Array.isArray(q?.scores) ? q.scores : [];
  const valid = points.map((_, i) => i).filter((i) => Number.isFinite(scores[i]) && typeof points[i]?.text === "string");

  const byScore = [...valid].sort((a, b) => scores[a] - scores[b]);
  const percentile = new Map(byScore.map((i, rank) => [i, byScore.length > 1 ? rank / (byScore.length - 1) : 1]));

  const asked = new Set(keywords(String(q?.text ?? "")));
  const shared = new Map(valid.map((i) => [i, keywords(points[i].text).filter((w) => asked.has(w))]));

  const options: Option[] = [];
  for (let x = 0; x < valid.length; x++) {
    for (let y = x + 1; y < valid.length; y++) {
      const [a, b] = [valid[x], valid[y]];
      const gap = Math.abs(scores[a] - scores[b]);
      if (!(gap > 1e-9)) continue; // a tie has no right answer
      const [lo, hi] = scores[a] < scores[b] ? [a, b] : [b, a];
      const loWords = shared.get(lo) ?? [];
      const lure = loWords.length > 0 && (shared.get(hi) ?? []).length === 0 ? loWords : null;

      const pa = points[a];
      const pb = points[b];
      const alike = pa.source === pb.source ? 0.15 : pa.group === pb.group ? 0.4 : 1;
      const relevance = 0.25 + 0.75 * (percentile.get(hi) ?? 0) ** 2;
      options.push({ lo, hi, gap, lure, weight: alike * relevance });
    }
  }
  return { index, id: String(q?.id ?? index), text: String(q?.text ?? ""), options };
}

/** Draws one option, with a chance proportional to its weight. */
function drawOne(rand: () => number, items: { option: Option; weight: number }[]) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  if (!(total > 0)) return items[Math.floor(rand() * items.length)].option;
  let r = rand() * total;
  let i = 0;
  while (i < items.length - 1 && r >= items[i].weight) r -= items[i++].weight;
  return items[i].option;
}

/** True when the data can deal at least one pair (one question with two notes it scores differently). */
export function playable(data: CloserData, points: readonly NoteRef[]): boolean {
  return (data?.questions ?? []).some((_, i) => buildDeck(data, points, i).options.length > 0);
}

export function isRight(pair: Pair, pick: Side): boolean {
  return pick === pair.answer;
}

/**
 * Deals a run. Each next() is one pair, harder as the streak grows: the bands narrow the score
 * gap, and from TRAP_FROM on some pairs are keyword traps. A question stays for QUESTION_EVERY
 * pairs, and the questions come round in a shuffled order, reshuffled when they run out.
 */
export function createRun(data: CloserData, points: readonly NoteRef[], seed: number): Run {
  const rand = mulberry32(seed);
  const questions = data?.questions ?? [];

  const decks = new Map<number, Deck>();
  const deckFor = (i: number) => {
    let deck = decks.get(i);
    if (!deck) decks.set(i, (deck = buildDeck(data, points, i)));
    return deck;
  };
  const usable = questions.map((_, i) => i).filter((i) => deckFor(i).options.length > 0);

  // The run's history: which pairs and notes have been shown, and on which side the answers fell.
  const shownPairs = new Map<string, number>();
  const shownNotes = new Map<number, number>();
  const recent: [number, number][] = [];
  const answers = [0, 0];

  let round = 0;
  let queue: number[] = [];
  let current = -1;

  /* A new question from the shuffled queue. Across a reshuffle, the last one never comes straight back. */
  function nextQuestion() {
    if (queue.length === 0) {
      queue = shuffle(rand, [...usable]);
      if (queue.length > 1 && queue[0] === current) {
        const j = 1 + Math.floor(rand() * (queue.length - 1));
        [queue[0], queue[j]] = [queue[j], queue[0]];
      }
    }
    current = queue.shift() ?? current;
  }

  /*
    The pairs a round may deal, loosest rule last. First the round's band, widened a step at a
    time, then the whole range above the floor. Only then are the variety rules let go: a note
    may show twice running, then a pair may come back, and last of all the gap may drop under
    the floor. Small data reaches those; the real notes never should. The last stage takes
    anything, so a usable question always deals.
  */
  function stages(r: number) {
    const band = bandFor(r);
    const out: Stage[] = [];
    for (let w = 0; w <= 6; w++) {
      out.push({ min: Math.max(GAP_FLOOR, band.min - 0.01 * w), max: band.max + 0.02 * w, apart: true, again: false });
    }
    out.push({ min: GAP_FLOOR, max: Infinity, apart: true, again: false });
    out.push({ min: GAP_FLOOR, max: Infinity, apart: false, again: false });
    out.push({ min: GAP_FLOOR, max: Infinity, apart: false, again: true });
    out.push({ min: 0, max: Infinity, apart: false, again: true });
    return out;
  }

  function choose(deck: Deck, r: number): Option {
    const last = recent[recent.length - 1];
    const before = recent[recent.length - 2];
    const inLast = (i: number) => last !== undefined && (last[0] === i || last[1] === i);
    const inBefore = (i: number) => before !== undefined && (before[0] === i || before[1] === i);

    /*
      Weights from the run so far: notes seen two pairs ago or often in this run are dealt
      less, so the cards keep changing. Before TRAP_FROM a pair that happens to be a trap is
      mostly left out, so the opening rounds read straight. After that, a chance trap is
      allowed, a little less often, since some are dealt on purpose as well.
    */
    const wanted = (o: Option) => {
      let w = o.weight;
      for (const i of [o.lo, o.hi]) {
        if (inBefore(i)) w *= 0.35;
        w /= 1 + 0.5 * (shownNotes.get(i) ?? 0);
      }
      if (o.lure) w *= r < TRAP_FROM ? 0.15 : 0.6;
      const again = shownPairs.get(pairKey(o.lo, o.hi)) ?? 0;
      return again > 0 ? w / (1 + 3 * again) : w;
    };

    const pool = (s: Stage, traps: boolean) =>
      deck.options
        .filter(
          (o) =>
            o.gap >= s.min &&
            o.gap <= s.max &&
            (!traps || o.lure !== null) &&
            (!s.apart || (!inLast(o.lo) && !inLast(o.hi))) &&
            (s.again || !shownPairs.has(pairKey(o.lo, o.hi))),
        )
        .map((option) => ({ option, weight: wanted(option) }));

    const all = stages(r);
    // A trap on purpose looks a couple of steps past the band at most, so it stays in the round's range.
    if (r >= TRAP_FROM && rand() < TRAP_RATE) {
      for (const s of all.slice(0, 3)) {
        const traps = pool(s, true);
        if (traps.length > 0) return drawOne(rand, traps);
      }
    }
    for (const s of all) {
      const items = pool(s, false);
      if (items.length > 0) return drawOne(rand, items);
    }
    return deck.options[0];
  }

  function next(): Pair {
    const r = round++;
    const previous = current;
    if (r % QUESTION_EVERY === 0 || current < 0) nextQuestion();

    // Data with nothing to deal (no question with two scored notes). playable() says so up front.
    if (current < 0) {
      const q = questions[0];
      return {
        round: r,
        question: { index: 0, id: String(q?.id ?? ""), text: String(q?.text ?? "") },
        fresh: r === 0,
        notes: [0, Math.min(1, Math.max(0, points.length - 1))],
        scores: [0, 0],
        answer: 0,
        gap: 0,
        heat: 1,
        trap: null,
      };
    }

    const deck = deckFor(current);
    const option = choose(deck, r);
    const scores = questions[current].scores;

    /* The answer side is a coin toss that leans against whichever side has had more answers this run. */
    const tilt = answers[0] - answers[1];
    const answer: Side = rand() < Math.min(0.8, Math.max(0.2, 0.5 - 0.15 * tilt)) ? 0 : 1;
    answers[answer]++;

    const notes: [number, number] = answer === 0 ? [option.hi, option.lo] : [option.lo, option.hi];
    const key = pairKey(option.lo, option.hi);
    shownPairs.set(key, (shownPairs.get(key) ?? 0) + 1);
    for (const i of notes) shownNotes.set(i, (shownNotes.get(i) ?? 0) + 1);
    recent.push(notes);
    if (recent.length > 2) recent.shift();

    return {
      round: r,
      question: { index: deck.index, id: deck.id, text: deck.text },
      fresh: r === 0 || current !== previous,
      notes,
      scores: [scores[notes[0]], scores[notes[1]]],
      answer,
      gap: option.gap,
      heat: 1 - clamp01((option.gap - GAP_FLOOR) / HEAT_SPAN),
      trap: option.lure ? { side: (1 - answer) as Side, words: option.lure } : null,
    };
  }

  return { seed, next };
}
