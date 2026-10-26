/*
  Every word Closer shows or announces, in one place so the copy can change without touching
  the components. The questions come from closer.json and the notes from retrieval.json.
  Scores arrive already formatted ("0.412"), so every line prints them the same way the cards do.

  Where the page copy (playCopy in src/content/copy.ts) has the same string, it's read from
  there, so it's written once.
*/

import { playCopy } from "@/content/copy";

/** 1024 as "1,024". */
const thousands = (n: number) => n.toLocaleString("en-US");

/** ["laravel", "php"] as “laravel” and “php”. */
function quoted(words: readonly string[]) {
  const q = words.map((w) => `“${w}”`);
  return q.length < 2 ? q.join("") : `${q.slice(0, -1).join(", ")} and ${q[q.length - 1]}`;
}

export const strings = {
  section: {
    eyebrow: playCopy.eyebrow,
    title: playCopy.title,
    intro: playCopy.intro,
  },

  poster: {
    kicker: "mini game",
    name: playCopy.title,
    stats: (notes: number, questions: number) => [`${questions} questions`, `${notes} notes`, "two at a time", "one miss ends it"],
    play: "Play",
    loading: "Shuffling…",
    failed: "The game didn't load, sorry. Here's a round I played earlier.",
  },

  /** Shown when scripts don't run: one round, already played. */
  static: {
    lead: playCopy.noScript,
    label: "an example round",
    questionLabel: "query",
    notesLabel: "The two notes",
    scoreLabel: "similarity",
    closer: "closer",
  },

  game: {
    questionLabel: "query",
    /** Which pair this is on the current question. */
    pairOf: (n: number, of: number) => `pair ${n} of ${of}`,
    newQuestion: "new question",
    how: "Which note does the model score closer to it?",
    notesLabel: "The two notes",
    scoreLabel: "cosine",
    /** Stands in for a score until the pick, same width so nothing moves. */
    hidden: "?.???",
    stampCloser: "closer",
    stampPick: "your pick",
    streak: "streak",
    best: (n: number) => `best ${n}`,
    /** The hint under the cloth, for a touch screen and for a mouse and keyboard. */
    touch: "Tap the note you think is closer.",
    keys: "Click a note, or press 1 or 2. The arrow keys work too.",
    gap: (gap: string) => `${gap} apart.`,
    skipTouch: "Tap for the next pair.",
    skip: "Click or press any key for the next pair.",
    /** The same, after a wrong call, when what comes next is the result. */
    endTouch: "Tap for the result.",
    end: "Click or press any key for the result.",
    clothEmpty: "Each right call adds a motif to this cloth.",
  },

  announce: {
    start: (question: string) => `Question: ${question} Pick the note the model scores closer.`,
    newQuestion: (question: string) => `New question: ${question}`,
    right: (win: string, lose: string, streak: number) => `Right, ${win} to ${lose}. Streak ${streak}.`,
    wrong: (win: string, lose: string) => `Not that one. The other note scored ${win}, yours ${lose}.`,
    goal: (goal: number) => `That's ${goal} in a row, the goal. Keep going if you like.`,
  },

  over: {
    /** The result heading, for screen readers. The big number stands in for it on screen. */
    head: (streak: number) => `Game over. Streak of ${streak}.`,
    streakLabel: (streak: number) => (streak === 1 ? "right call" : "in a row"),
    best: (n: number) => `best ${n}`,
    newBest: "new best",
    line: (streak: number, goal: number, dims: number) => {
      if (streak === 0) return "Out on the first pair. The model has had more practice.";
      if (streak < 3) return "A short run. Sudden death is like that.";
      if (streak < 6) return `Not bad. The model needed ${thousands(dims)} numbers per note to do that.`;
      if (streak < goal) return "That's a proper run. You read my notes the way the model does.";
      return `${streak} in a row. Either you think in vectors or you read my notes very closely.`;
    },
    /** Why the last pair went the way it did. */
    why: {
      trap: (words: readonly string[], win: string, lose: string) =>
        `Your pick shares ${quoted(words)} with the question and still lost, ${lose} to ${win}. The model compares meaning, not shared words.`,
      close: (win: string, lose: string, gap: string) => `${win} vs ${lose}, only ${gap} apart. The model barely split them.`,
      plain: (win: string, lose: string) => `The other note scored ${win} to your ${lose}. To the model, it was closer in meaning.`,
    },
    again: playCopy.again,
    answer: "See the real answer",
  },
};

export type Strings = typeof strings;
