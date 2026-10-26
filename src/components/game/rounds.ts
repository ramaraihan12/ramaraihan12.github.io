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
  /**
   * The lower-scoring side shares these meaningful words with the question, and the higher
   * shares none. They're matched by stem and spelled as in the question, so the note may have
   * "payment" where the question says "payments"; stem() finds them in the note.
   */
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

export type Band = {
  /** The first round (streak) the band applies to. */
  from: number;
  /** The score gaps it deals from. */
  min: number;
  max: number;
  /**
   * How question-independent its pairs may be: the share of the other questions under which
   * the same note wins too. Pairs above it are dealt rarely. See buildDeck for why.
   */
  agree: number;
};

/*
  How a run gets harder, in two dials. The gap is the obvious one. The other is how much the
  answer turns on the question: early pairs are ones only this question decides, which a
  careful reader gets nearly every time. The last band lets in the pairs the model decides by
  habit (the about note beats most notes on most questions), which only a player who has
  learned its habits will read.

  Tuned against closer.json with a local LLM standing in for a careful player, on 610 pairs.
  It agreed with the model on 84% of pairs with agree under 0.3, and on under half of those
  over 0.7. The gap on its own barely moved it (53% under 0.03, about 60% above). Played
  through these bands, it reaches STREAK_GOAL in about one run in nine, and 13 in one in 30.
  That was on thirteen questions. On the ten now, with the weighted question order and the
  late pairs kept near each question's best notes, a simulated player who gets those same
  shares right reaches 5 in one run in three, 10 in about one in eleven, and 13 in about one
  in 25.
*/
export const BANDS: readonly Band[] = [
  { from: 0, min: 0.12, max: Infinity, agree: 0.3 },
  { from: 3, min: 0.07, max: 0.15, agree: 0.4 },
  { from: 6, min: 0.04, max: 0.09, agree: 0.45 },
  { from: 10, min: 0.015, max: 0.04, agree: 0.7 },
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

/**
 * From this round on, the higher note should be one of the question's real matches: no further
 * than NEAR_BEST behind its closest note. Then the close calls are two good matches a hair apart,
 * not two misses. A cut by rank can't do this, since some questions have three real matches and
 * some six, and past those come the notes that score well on everything.
 */
const NEAR_FROM = 6;
const NEAR_BEST = 0.1;

/**
 * How much a note is still wanted 1, 2, 3 and 4 pairs after it was shown. The last pair's notes
 * are kept out altogether while anything else is left, so the first only counts on tiny data.
 */
const RECENT = [1, 0.05, 0.25, 0.5, 0.75];

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

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Lowercase word tokens (\p{L}\p{N}), like pool.ts `words`. */
export function words(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/*
  Words that say nothing about what a note is about. The question words and pronouns go, and so
  do "rama" and "raihan": every note is Rama's, so his name is never a real lure. The odd
  letters are what's left of contractions once they're split ("i'm" is "i" and "m").
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

/**
 * A word without its plural or -ing, -ed, -ly ending, so "payments" meets "payment" and
 * "locally" meets "local". Crude on purpose: both sides go through the same cuts, so a word
 * only has to be cut the same way twice, not correctly.
 */
export function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (/(ss|sh|ch|x)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && /[^su]s$/.test(word)) return word.slice(0, -1);
  const ending = /^(.{4,}?)(ing|ed|ly)$/.exec(word);
  if (!ending) return word;
  const base = ending[1];
  return /([b-df-hj-np-tv-z])\1$/.test(base) ? base.slice(0, -1) : base;
}

/** One way to pair two notes under one question, lower score first. */
type Option = {
  lo: number;
  hi: number;
  gap: number;
  /** Words the lower note shares with the question, when the higher one shares none. */
  lure: string[] | null;
  /** How much this pair is wanted before the round and the run's own history are counted. */
  weight: number;
  /** The share of the other questions under which the same note wins too. */
  agree: number;
  /** Where the lower note ranks among the question's notes, 0 (last) to 1 (first). */
  depth: number;
  /** How far the higher note's score is behind the question's closest note. */
  behind: number;
};

type Deck = {
  index: number;
  id: string;
  text: string;
  options: Option[];
  /** How many pairs the first band deals as they are: in its gaps, under its agree cap, and not traps. */
  clear: number;
};

/**
 * One step of loosening the rules: the gaps allowed, whether the higher note must be NEAR_BEST,
 * whether both notes must be new since the last pair, whether a pair may come back.
 */
type Stage = { min: number; max: number; near: boolean; apart: boolean; again: boolean };

const pairKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

const scoresOf = (q: CloserData["questions"][number] | undefined) => (Array.isArray(q?.scores) ? q.scores : []);

/*
  Every pair of notes a question can deal, with what's known about it before a run starts:
  - Two notes from different groups (or at least different files) read less alike, so the
    player compares ideas, not wording.
  - A pair whose better note is one of the question's real matches is a fair read, so the
    higher the better note ranks, the more the pair is wanted.
  - Some notes score high on nearly every question (the about note, the python note) and some
    low on all of them (warung-pos, antre). The model picks those by habit, not by the
    question, and a reader can't see a habit, so `agree` counts how often the same note wins
    under the other questions. Each band caps it (see BANDS).
*/
function buildDeck(data: CloserData, points: readonly NoteRef[], index: number): Deck {
  const q = data.questions[index];
  const scores = scoresOf(q);
  const valid = points.map((_, i) => i).filter((i) => Number.isFinite(scores[i]) && typeof points[i]?.text === "string");
  const others = data.questions.filter((_, j) => j !== index).map(scoresOf);

  const byScore = [...valid].sort((a, b) => scores[a] - scores[b]);
  const percentile = new Map(byScore.map((i, rank) => [i, byScore.length > 1 ? rank / (byScore.length - 1) : 1]));
  const best = byScore.length > 0 ? scores[byScore[byScore.length - 1]] : 0;

  // The words a note shares with the question, matched by stem and given as the question has them.
  const asked = new Map(keywords(String(q?.text ?? "")).map((w) => [stem(w), w]));
  const shared = new Map(
    valid.map((i) => {
      const stems = new Set(keywords(points[i].text).map(stem));
      return [i, [...asked].filter(([s]) => stems.has(s)).map(([, w]) => w)];
    }),
  );

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
      const relevance = 0.25 + 0.75 * (percentile.get(hi) ?? 0) ** 3;

      let wins = 0;
      let counted = 0;
      for (const s of others) {
        if (!Number.isFinite(s[lo]) || !Number.isFinite(s[hi])) continue;
        counted++;
        if (s[hi] > s[lo]) wins++;
      }
      options.push({
        lo,
        hi,
        gap,
        lure,
        weight: alike * relevance,
        agree: counted > 0 ? wins / counted : 0.5,
        depth: percentile.get(lo) ?? 0,
        behind: best - scores[hi],
      });
    }
  }
  const first = BANDS[0];
  const clear = options.filter((o) => o.gap >= first.min && o.gap <= first.max && o.agree <= first.agree && o.lure === null).length;
  return { index, id: String(q?.id ?? index), text: String(q?.text ?? ""), options, clear };
}

const cache = new WeakMap<CloserData, WeakMap<readonly NoteRef[], Deck[]>>();

/* The decks depend only on the data, so every run over the same data shares them. */
function decksFor(data: CloserData, points: readonly NoteRef[]): Deck[] {
  if (!data || typeof data !== "object" || !Array.isArray(data.questions) || !Array.isArray(points)) return [];
  let byPoints = cache.get(data);
  if (!byPoints) cache.set(data, (byPoints = new WeakMap()));
  let decks = byPoints.get(points);
  if (!decks) byPoints.set(points, (decks = data.questions.map((_, i) => buildDeck(data, points, i))));
  return decks;
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
  return decksFor(data, points).some((deck) => deck.options.length > 0);
}

export function isRight(pair: Pair, pick: Side): boolean {
  return pick === pair.answer;
}

/**
 * Deals a run. Each next() is one pair, harder as the streak grows: the bands narrow the score
 * gap, and from TRAP_FROM on some pairs are keyword traps. A question stays for QUESTION_EVERY
 * pairs, and the questions come round in a weighted shuffle that tends to open on the clearer
 * ones, reshuffled when they run out.
 */
export function createRun(data: CloserData, points: readonly NoteRef[], seed: number): Run {
  const rand = mulberry32(seed);
  const decks = decksFor(data, points);
  const usable = decks.filter((deck) => deck.options.length > 0).map((deck) => deck.index);

  // The run's history: which pairs and notes have been shown, and on which side the answers fell.
  const shownPairs = new Map<string, number>();
  const shownNotes = new Map<number, number>();
  const recent: [number, number][] = [];
  const answers = [0, 0];
  let lastAnswer: Side | null = null;
  let sameSide = 0;

  let round = 0;
  let queue: number[] = [];
  let current = -1;

  /*
    The questions come in a weighted shuffle, so the ones with clear pairs tend to open the run.
    A question with none (all its wide gaps go to notes that win under most questions anyway)
    opens on pairs the model decides by habit, and loses careful players in the first three.
    Each question draws rand() ** (1 / weight) and the highest goes first, so a question twice
    the weight is twice as likely to lead. The weight levels off, since ten clear pairs open a
    run about as well as a hundred, and never reaches 0, so any question can lead.
  */
  const lead = (index: number) => {
    const clear = decks[index].clear;
    return 0.15 + clear / (clear + 10);
  };
  const weightedShuffle = (list: number[]) =>
    list
      .map((index) => ({ index, key: rand() ** (1 / lead(index)) }))
      .sort((a, b) => b.key - a.key)
      .map((item) => item.index);

  /* A new question from the shuffled queue. Across a reshuffle, the last one never comes straight back. */
  function nextQuestion() {
    if (queue.length === 0) {
      queue = weightedShuffle(usable);
      if (queue.length > 1 && queue[0] === current) {
        const j = 1 + Math.floor(rand() * (queue.length - 1));
        [queue[0], queue[j]] = [queue[j], queue[0]];
      }
    }
    current = queue.shift() ?? current;
  }

  /*
    The pairs a round may deal, loosest rule last. First the round's band, widened a step at a
    time; from NEAR_FROM on that's done twice, first with the higher note NEAR_BEST, so a wider
    gap comes before a note that misses. Then the whole range above the floor. Only then are
    the variety rules let go: a note may show twice running, then a pair may come back, and
    last of all the gap may drop under the floor. Small data reaches those; the real notes
    never should. The last stage takes anything, so a usable question always deals.
  */
  function stages(r: number) {
    const band = bandFor(r);
    const out: Stage[] = [];
    for (const near of r >= NEAR_FROM ? [true, false] : [false]) {
      for (let w = 0; w <= 6; w++) {
        out.push({ min: Math.max(GAP_FLOOR, band.min - 0.01 * w), max: band.max + 0.02 * w, near, apart: true, again: false });
      }
    }
    out.push({ min: GAP_FLOOR, max: Infinity, near: false, apart: true, again: false });
    out.push({ min: GAP_FLOOR, max: Infinity, near: false, apart: false, again: false });
    out.push({ min: GAP_FLOOR, max: Infinity, near: false, apart: false, again: true });
    out.push({ min: 0, max: Infinity, near: false, apart: false, again: true });
    return out;
  }

  function choose(deck: Deck, r: number): Option {
    const last = recent[recent.length - 1];
    const inLast = (i: number) => last !== undefined && (last[0] === i || last[1] === i);
    const ago = (i: number) => {
      for (let k = 1; k <= recent.length; k++) if (recent[recent.length - k].includes(i)) return k;
      return 0;
    };
    const cap = bandFor(r).agree;
    const close = 4 * clamp01((r - 5) / 5);

    /*
      Weights from the round and the run so far:
      - Pairs the question decides are wanted more, and pairs over the band's agree cap are
        dealt rarely (not never, so small data still deals).
      - In the close calls both notes should be about the question. Two notes that both miss
        it, 0.03 apart, are noise, and the reveal has nothing to say about them. So from round
        5 to 10 the lower note's rank counts more and more, until the late pairs are two of the
        question's better matches.
      - Notes seen a few pairs ago, or often in this run, are dealt less, so the cards keep
        changing and no note turns up in most pairs.
      - Before TRAP_FROM a pair that happens to be a trap is mostly left out, so the opening
        rounds read straight. After that a chance trap is fine, a little less often, since
        some are dealt on purpose as well.
    */
    const wanted = (o: Option) => {
      let w = o.weight * (1.05 - o.agree) ** 2 * (o.agree > cap ? 0.03 : 1) * (0.05 + 0.95 * o.depth) ** close;
      for (const i of [o.lo, o.hi]) {
        w *= RECENT[ago(i)] ?? 1;
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
            (!s.near || o.behind <= NEAR_BEST + 1e-9) &&
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
      const q = data?.questions?.[0];
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

    const deck = decks[current];
    const option = choose(deck, r);
    const scores = scoresOf(data.questions[current]);

    /*
      The answer side is a coin toss that leans against whichever side has had more answers
      this run, and never lands the same way a fifth time running.
    */
    const tilt = answers[0] - answers[1];
    let answer: Side = rand() < Math.min(0.8, Math.max(0.2, 0.5 - 0.15 * tilt)) ? 0 : 1;
    if (sameSide >= 4 && answer === lastAnswer) answer = answer === 0 ? 1 : 0;
    sameSide = answer === lastAnswer ? sameSide + 1 : 1;
    lastAnswer = answer;
    answers[answer]++;

    const notes: [number, number] = answer === 0 ? [option.hi, option.lo] : [option.lo, option.hi];
    const key = pairKey(option.lo, option.hi);
    shownPairs.set(key, (shownPairs.get(key) ?? 0) + 1);
    for (const i of notes) shownNotes.set(i, (shownNotes.get(i) ?? 0) + 1);
    recent.push(notes);
    if (recent.length > RECENT.length - 1) recent.shift();

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
