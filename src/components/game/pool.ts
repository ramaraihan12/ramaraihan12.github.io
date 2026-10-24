import type retrievalData from "@/content/retrieval.json";

/*
  The rules of Nearest Neighbors, with no React and no DOM, so they're easy to reason about.
  Everything is read from retrieval.json: the number of notes, the real top results and their
  scores can all change when the notes are embedded again.
*/

export type Retrieval = typeof retrievalData;

/** Why a decoy made it into the pool, so the reveal can say what made it tempting. */
export type Trap = "near" | "group" | "words" | "plain";

export type Candidate = {
  /** Index into data.points. */
  index: number;
  /** A, B, C… in the order the cards are shown, also the dot's label on the map. */
  letter: string;
  /** Rank in data.top (0 is the best match), or -1 for a decoy. */
  rank: number;
  /** Cosine similarity in the full embedding, known only for the real top results. */
  score: number | null;
  trap: Trap | null;
  /** Words it shares with the question, for "words" traps. */
  shared: string[];
  /** Distance to the query on the 2D map, which is not the distance the model ranks by. */
  mapDistance: number;
};

export type Pool = { seed: number; k: number; candidates: Candidate[] };

export type Grade = {
  hits: number;
  k: number;
  /** Share of the picks that are in the real top k. With exactly k picks, also the recall. */
  precision: number;
  perfect: boolean;
  /** A decoy that sits closer to the query on the map than a real match, if the pool has one. */
  squash: { decoy: Candidate; hit: Candidate } | null;
};

/** Small seeded PRNG (mulberry32). The same seed always deals the same pool. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

type Weighted = { index: number; weight: number };

/** Draws up to n items without replacement, each with a chance proportional to its weight. */
function draw(rand: () => number, items: Weighted[], n: number, taken: Set<number>) {
  const left = items.filter((item) => item.weight > 0 && !taken.has(item.index));
  const out: number[] = [];
  while (out.length < n && left.length > 0) {
    const total = left.reduce((sum, item) => sum + item.weight, 0);
    let r = rand() * total;
    let i = 0;
    while (i < left.length - 1 && r >= left[i].weight) r -= left[i++].weight;
    out.push(left[i].index);
    taken.add(left[i].index);
    left.splice(i, 1);
  }
  return out;
}

function shuffle<T>(rand: () => number, list: T[]) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

const letterAt = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : String(i + 1));

/**
 * The real top k plus `decoys` tricky notes, shuffled. A few decoys sit close to the query on
 * the 2D map, a few come from the same group as the real matches (they sound like an answer),
 * and a few share words with the question. Anything left over is drawn at random.
 */
export function buildPool(data: Retrieval, seed: number, decoys = 7): Pool {
  const rand = mulberry32(seed);
  const q = data.query;
  const k = data.top.length;
  const topRank = new Map(data.top.map((t, rank) => [t.index, rank]));
  const dist = data.points.map((p) => Math.hypot(p.x - q.x, p.y - q.y));
  const others = data.points.map((_, i) => i).filter((i) => !topRank.has(i));
  const count = Math.min(decoys, others.length);

  // Near on the map: the closest decoys, closer ones more likely. Preferably closer than the
  // farthest real match, which is exactly the case the reveal wants to point out.
  const farthestHit = Math.max(...data.top.map((t) => dist[t.index]));
  const byDistance = [...others].sort((a, b) => dist[a] - dist[b]);
  const inside = byDistance.filter((i) => dist[i] < farthestHit);
  const near = (inside.length >= 3 ? inside : byDistance).slice(0, 8);

  // Sounds like an answer: same group as the real matches, weighted by how many matches it has.
  const hitGroups = new Map<string, number>();
  for (const t of data.top) {
    const g = data.points[t.index].group;
    hitGroups.set(g, (hitGroups.get(g) ?? 0) + 1);
  }

  // Shares words with the question, rarer words counting for more.
  const asked = new Set(words(data.question));
  const docFreq = new Map<string, number>();
  for (const p of data.points) for (const w of new Set(words(p.text))) docFreq.set(w, (docFreq.get(w) ?? 0) + 1);
  const shared = data.points.map((p) => [...new Set(words(p.text))].filter((w) => asked.has(w)));
  const overlap = (i: number) =>
    shared[i].reduce((sum, w) => sum + Math.log((data.points.length + 1) / ((docFreq.get(w) ?? 0) + 1)), 0);

  const nNear = Math.ceil(count * 0.43);
  const nGroup = Math.floor((count - nNear) / 2);
  const nWords = count - nNear - nGroup;

  const taken = new Set<number>();
  const trap = new Map<number, Trap>();
  const pick = (kind: Trap, items: Weighted[], n: number) => draw(rand, items, n, taken).forEach((i) => trap.set(i, kind));

  pick("near", near.map((index, i) => ({ index, weight: near.length - i })), nNear);
  pick("group", others.map((index) => ({ index, weight: hitGroups.get(data.points[index].group) ?? 0 })), nGroup);
  pick("words", others.map((index) => ({ index, weight: overlap(index) })), nWords);
  pick("plain", others.map((index) => ({ index, weight: 1 })), count - taken.size);

  const order = shuffle(rand, [...data.top.map((t) => t.index), ...taken]);
  const candidates = order.map((index, i): Candidate => {
    const rank = topRank.get(index) ?? -1;
    return {
      index,
      letter: letterAt(i),
      rank,
      score: rank >= 0 ? data.top[rank].score : null,
      trap: trap.get(index) ?? null,
      shared: trap.get(index) === "words" ? shared[index] : [],
      mapDistance: dist[index],
    };
  });
  return { seed, k, candidates };
}

export function grade(pool: Pool, picked: readonly number[]): Grade {
  const chosen = new Set(picked);
  const hits = pool.candidates.filter((c) => c.rank >= 0 && chosen.has(c.index)).length;

  // The honest caveat: the map is a squash of the full embedding, so some decoys look closer
  // than real matches. Point at the farthest real match and a decoy that beats it on the map,
  // preferably one the player fell for.
  const real = pool.candidates.filter((c) => c.rank >= 0);
  const hit = real.reduce((a, b) => (b.mapDistance > a.mapDistance ? b : a), real[0]);
  const closer = pool.candidates
    .filter((c) => c.rank < 0 && hit && c.mapDistance < hit.mapDistance)
    .sort((a, b) => Number(chosen.has(b.index)) - Number(chosen.has(a.index)) || a.mapDistance - b.mapDistance);

  return {
    hits,
    k: pool.k,
    precision: pool.k > 0 ? hits / pool.k : 0,
    perfect: hits === pool.k,
    squash: closer.length > 0 ? { decoy: closer[0], hit } : null,
  };
}
