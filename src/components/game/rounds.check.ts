/*
  A small check for rounds.ts, no test framework. Run it from the repo root with:

    npx tsx src/components/game/rounds.check.ts

  It deals a few thousand runs and fails loudly if a rule is broken, then prints one sample run
  so a person can judge whether the calls feel fair. It reads src/content/closer.json when it's
  there, and otherwise makes up scores for the real notes.
*/
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import retrieval from "../../content/retrieval.json";
import {
  BANDS,
  GAP_FLOOR,
  QUESTION_EVERY,
  STREAK_GOAL,
  TRAP_FROM,
  bandFor,
  createRun,
  isRight,
  keywords,
  playable,
  stem,
  words,
  type CloserData,
  type NoteRef,
  type Pair,
} from "./rounds";

const points: NoteRef[] = retrieval.points;

/* Stand-in scores for when closer.json isn't there yet: ten questions, each note somewhere in 0.2..0.65. */
function synthetic(): CloserData {
  let a = 2026;
  const rand = () => {
    a = (a * 1103515245 + 12345) % 2147483648;
    return a / 2147483648;
  };
  const texts = [
    "What does he deploy his apps with?",
    "Has he built anything with payments?",
    "Which databases does he know?",
    "Does he build AI agents?",
    "What frontend tools does he use?",
    "Where is Rama Raihan from?",
    "How does he test his code?",
    "Can his AI apps run without an API key?",
    "What does he do with Laravel?",
    "Has he made anything for streamers?",
  ];
  return {
    model: "synthetic",
    dims: 1024,
    questions: texts.map((text, i) => ({ id: `q${i}`, text, scores: points.map(() => 0.2 + 0.45 * rand()) })),
  };
}

const file = join(process.cwd(), "src/content/closer.json");
const real = existsSync(file);
const data: CloserData = real ? JSON.parse(readFileSync(file, "utf8")) : synthetic();
console.log(`data: ${real ? `closer.json (${data.model}, ${data.questions.length} questions)` : "synthetic scores"}, ${points.length} notes`);

const deal = (seed: number, n: number, d: CloserData = data, p: readonly NoteRef[] = points) => {
  const run = createRun(d, p, seed);
  return Array.from({ length: n }, () => run.next());
};

const SEEDS = 400;
const LENGTH = 40;
const runs = Array.from({ length: SEEDS }, (_, s) => deal(s * 7919 + 1, LENGTH));

// Determinism: the same seed deals the same run, another seed doesn't.
assert.deepEqual(deal(42, 30), deal(42, 30));
assert.notDeepEqual(deal(42, 30), deal(43, 30));
assert.equal(createRun(data, points, 42).seed, 42);

// Every pair is consistent with the data, and a right pick is the higher score.
for (const run of runs) {
  run.forEach((pair, r) => {
    const q = data.questions[pair.question.index];
    assert.equal(pair.round, r);
    assert.equal(pair.question.id, q.id);
    assert.equal(pair.question.text, q.text);
    assert.notEqual(pair.notes[0], pair.notes[1]);
    assert.equal(pair.scores[0], q.scores[pair.notes[0]]);
    assert.equal(pair.scores[1], q.scores[pair.notes[1]]);
    assert.ok(pair.scores[pair.answer] > pair.scores[1 - pair.answer], "the answer is the higher score");
    assert.ok(isRight(pair, pair.answer) && !isRight(pair, pair.answer === 0 ? 1 : 0));
    assert.ok(Math.abs(pair.gap - Math.abs(pair.scores[0] - pair.scores[1])) < 1e-12);
    assert.ok(pair.gap >= GAP_FLOOR, `gap ${pair.gap} under the floor in round ${r}`);
    assert.ok(pair.heat >= 0 && pair.heat <= 1);
  });
}

// No pair twice in a run, and no note in two pairs running.
for (const run of runs) {
  const seen = new Set<string>();
  run.forEach((pair, r) => {
    const key = [...pair.notes].sort((a, b) => a - b).join(":");
    assert.ok(!seen.has(key), `pair ${key} dealt twice`);
    seen.add(key);
    if (r > 0) for (const i of pair.notes) assert.ok(!run[r - 1].notes.includes(i), `note ${i} in two pairs running`);
  });
}

// The question changes exactly every QUESTION_EVERY pairs, never back to back, and every question comes up once before any comes twice.
for (const run of runs) {
  run.forEach((pair, r) => {
    const turn = r % QUESTION_EVERY === 0;
    assert.equal(pair.fresh, turn, `fresh is ${pair.fresh} in round ${r}`);
    if (r > 0 && !turn) assert.equal(pair.question.index, run[r - 1].question.index);
    if (r > 0 && turn) assert.notEqual(pair.question.index, run[r - 1].question.index);
  });
  const order = run.filter((p) => p.fresh).map((p) => p.question.index);
  const first = order.slice(0, data.questions.length);
  assert.equal(new Set(first).size, first.length, "a question came back before the others had their turn");
}

// The gap shrinks as the streak grows.
const meanGap = (from: number, to: number) => {
  const gaps = runs.flatMap((run) => run.slice(from, to + 1).map((p) => p.gap));
  return gaps.reduce((s, g) => s + g, 0) / gaps.length;
};
const early = meanGap(0, 2);
const middle = meanGap(3, 5);
const late = meanGap(6, 9);
const later = meanGap(10, 14);
console.log(`mean gap: rounds 0-2 ${early.toFixed(3)}, 3-5 ${middle.toFixed(3)}, 6-9 ${late.toFixed(3)}, 10-14 ${later.toFixed(3)}`);
assert.ok(early > middle && middle > late && late > later, "the gap trends down with the round");

// How often a round has to leave its band, which says whether the bands suit the data.
let outside = 0;
let dealt = 0;
for (const run of runs) {
  for (const pair of run) {
    const band = bandFor(pair.round);
    dealt++;
    if (pair.gap < band.min - 1e-12 || pair.gap > band.max + 1e-12) outside++;
  }
}
console.log(`bands: ${BANDS.map((b) => `${b.from}+ ${b.min}-${b.max === Infinity ? "" : b.max}`).join(", ")}; ${((outside / dealt) * 100).toFixed(1)}% of pairs dealt outside their band`);

// The answer lands on either side about equally.
const lefts = runs.flat().filter((p) => p.answer === 0).length;
const share = lefts / (SEEDS * LENGTH);
let longest = 0;
for (const run of runs) {
  let streak = 0;
  run.forEach((p, r) => {
    streak = r > 0 && p.answer === run[r - 1].answer ? streak + 1 : 1;
    longest = Math.max(longest, streak);
  });
}
console.log(`answer on the first card: ${(share * 100).toFixed(1)}%, longest same-side streak: ${longest}`);
assert.ok(share > 0.47 && share < 0.53, `answers lean to one side (${share})`);

// Traps: they appear, they really are traps, and every pair that is one says so.
let traps = 0;
let trapRounds = 0;
let earlyTraps = 0;
const stems = (text: string) => new Set(keywords(text).map(stem));
for (const run of runs) {
  for (const pair of run) {
    const asked = stems(pair.question.text);
    const lower = pair.answer === 0 ? 1 : 0;
    const sharedLow = [...stems(points[pair.notes[lower]].text)].filter((s) => asked.has(s));
    const sharedHigh = [...stems(points[pair.notes[pair.answer]].text)].filter((s) => asked.has(s));
    const isTrap = sharedLow.length > 0 && sharedHigh.length === 0;
    assert.equal(pair.trap !== null, isTrap, `round ${pair.round} trap flag is wrong`);
    if (pair.trap) {
      assert.equal(pair.trap.side, lower);
      assert.ok(pair.trap.words.length > 0);
      for (const w of pair.trap.words) {
        assert.ok(words(pair.question.text).includes(w), `"${w}" isn't in the question`);
        assert.ok(words(points[pair.notes[lower]].text).some((v) => stem(v) === stem(w)), `"${w}" isn't in the lower note`);
        assert.ok(!words(points[pair.notes[pair.answer]].text).some((v) => stem(v) === stem(w)), `"${w}" is in the higher note too`);
        assert.ok(!["rama", "raihan", "the", "does", "he"].includes(w), `"${w}" is a stopword`);
      }
    }
    if (pair.round >= TRAP_FROM) {
      trapRounds++;
      if (pair.trap) traps++;
    } else if (pair.trap) earlyTraps++;
  }
}
console.log(`traps: ${((traps / trapRounds) * 100).toFixed(1)}% of pairs from round ${TRAP_FROM}, ${earlyTraps} before it in ${SEEDS} runs`);
assert.ok(traps > 0, "no traps at all");

// Odd and tiny data never throws, never stalls and still deals real pairs.
const tiny = (questions: number, notes: number, scores?: (q: number, i: number) => number): [CloserData, NoteRef[]] => [
  {
    model: "tiny",
    dims: 3,
    questions: Array.from({ length: questions }, (_, q) => ({
      id: `t${q}`,
      text: `Does he write tests in note ${q}?`,
      scores: Array.from({ length: notes }, (_, i) => (scores ? scores(q, i) : 0.2 + ((i * 37 + q * 11) % 50) / 100)),
    })),
  },
  Array.from({ length: notes }, (_, i) => ({ source: `n${i % 3}`, group: `g${i % 2}`, text: `note ${i} about tests` })),
];
const odd: [string, CloserData, readonly NoteRef[]][] = [
  ["2 questions, 6 notes", ...tiny(2, 6)],
  ["2 questions, 2 notes", ...tiny(2, 2)],
  ["1 question, 3 notes", ...tiny(1, 3)],
  ["3 questions, 51 notes", ...tiny(3, 51)],
  ["half the scores missing", ...tiny(2, 8, (q, i) => (i % 2 ? NaN : 0.3 + i / 100))],
  ["every score the same", ...tiny(2, 6, () => 0.4)],
  ["one question all ties", ...tiny(2, 6, (q, i) => (q === 0 ? 0.4 : 0.3 + i / 50))],
  ["no questions", ...tiny(0, 6)],
  ["no notes", ...tiny(2, 0)],
  ["scores shorter than notes", { model: "x", dims: 1, questions: [{ id: "a", text: "a", scores: [0.1, 0.5] }] }, points],
];
for (const [name, d, p] of odd) {
  const start = Date.now();
  const pairs = deal(5, 60, d, p);
  assert.equal(pairs.length, 60, name);
  if (playable(d, p)) {
    for (const pair of pairs) {
      assert.ok(pair.notes.every((i) => i >= 0 && i < p.length), `${name}: note out of range`);
      assert.ok(pair.scores[pair.answer] > pair.scores[1 - pair.answer], `${name}: no right answer`);
    }
  }
  assert.ok(Date.now() - start < 2000, `${name} is slow`);
}
assert.ok(!playable(...tiny(2, 6, () => 0.4)) && !playable(...tiny(0, 6)) && playable(...tiny(2, 6)));

// One run to read through. ✓ marks the note the model scores closer, ⚑ a keyword trap.
const sample = deal(Number(process.argv[2] ?? 20261026), 14);
const name = (i: number) => points[i].source.padEnd(22);
console.log(`\nsample run (seed ${process.argv[2] ?? 20261026}):`);
for (const pair of sample) {
  if (pair.fresh) console.log(`\n  "${pair.question.text}"`);
  const card = (side: 0 | 1) => `${pair.answer === side ? "✓" : " "} ${name(pair.notes[side])} ${pair.scores[side].toFixed(3)}`;
  const trap = pair.trap ? `  ⚑ ${pair.trap.words.join(", ")}` : "";
  console.log(`  ${String(pair.round).padStart(2)}  ${card(0)}   ${card(1)}   gap ${pair.gap.toFixed(3)} heat ${pair.heat.toFixed(2)}${trap}`);
}

// A rough feel for difficulty: a player who only matches keywords, and who guesses on a tie.
const reach = (pick: (pair: Pair) => 0 | 1) => {
  let made = 0;
  for (let s = 0; s < 2000; s++) {
    const run = createRun(data, points, s * 104729 + 3);
    let streak = 0;
    for (let pair = run.next(); streak < STREAK_GOAL && isRight(pair, pick(pair)); pair = run.next()) streak++;
    if (streak >= STREAK_GOAL) made++;
  }
  return made / 2000;
};
let coin = 1;
const byKeywords = (pair: Pair, against: boolean): 0 | 1 => {
  const asked = stems(pair.question.text);
  const hits = pair.notes.map((i) => [...stems(points[i].text)].filter((s) => asked.has(s)).length);
  if (hits[0] !== hits[1]) return hits[0] > hits[1] !== against ? 0 : 1;
  coin = (coin * 16807) % 2147483647;
  return coin % 2 === 0 ? 0 : 1;
};
const withWords = reach((pair) => byKeywords(pair, false));
const againstWords = reach((pair) => byKeywords(pair, true));
console.log(
  `\nreaching ${STREAK_GOAL}: a player who follows shared words ${(withWords * 100).toFixed(1)}%, one who avoids them ${(againstWords * 100).toFixed(1)}%, a coin ${(100 / 2 ** STREAK_GOAL).toFixed(2)}%`,
);

console.log("\nok");
