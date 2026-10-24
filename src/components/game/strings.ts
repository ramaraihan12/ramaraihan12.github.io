/*
  Every word the Nearest Neighbors game shows or announces, in one place so the final copy can
  be dropped in without touching the components. The question and the notes themselves come
  from retrieval.json. Functions take the numbers they need, since the number of notes and the
  size of the top list come from the data too.
*/

const numberWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

/** "five" for 5, digits past twelve. */
export const numberWord = (n: number) => numberWords[n] ?? String(n);

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** 1024 as "1,024". */
const thousands = (n: number) => n.toLocaleString("en-US");

export const strings = {
  section: {
    eyebrow: "play",
    title: "Your turn to be the retriever",
    intro: (k: number) =>
      `You just watched the model pick its ${numberWord(k)} notes. Now you try. Same question, a shuffled pile of my notes, and no scrolling back up to peek.`,
  },

  poster: {
    kicker: "mini game",
    name: "Nearest Neighbors",
    stats: (n: number, k: number) => [`${n} notes`, `pick ${k}`, "scored by cosine"],
    play: "Play",
    loading: "Shuffling…",
    failed: (k: number) => `The game didn't load, sorry. Here are the ${numberWord(k)} it was hiding.`,
  },

  /** Shown when scripts don't run. The real top results are listed after it. */
  static: {
    lead: (k: number) =>
      `With JavaScript on, this is a small game: you get the question and a pile of my notes, and you pick the ${numberWord(k)} you think the model picked. These are the ${numberWord(k)} it actually picked.`,
    listLabel: (k: number) => `The real top ${k}`,
    scoreLabel: "similarity",
  },

  game: {
    questionLabel: "query",
    instruction: (k: number) => `Pick the ${numberWord(k)} notes you think are closest in meaning to the question.`,
    cardsLabel: "Candidate notes",
    counter: (n: number, k: number) => `${n} of ${k} picked`,
    best: (best: number, k: number) => `best ${best}/${k}`,
    check: (k: number) => `Check my ${numberWord(k)}`,
    checking: "Checking…",
    needMore: (left: number) => `Pick ${left} more`,
    full: (k: number) => `That's ${numberWord(k)}. Unpick one to swap it.`,
    checkEarly: (left: number) => `Pick ${numberWord(left)} more first.`,
    start: (n: number, k: number) => `${capitalize(numberWord(n))} notes. Pick the ${numberWord(k)} closest in meaning to the question.`,
    picked: "picked",
  },

  map: {
    query: "question",
    looksClose: "looks close",
    legendQuery: "the question",
    legendPick: "your pick",
    legendTop: (k: number) => `real top ${k}`,
    caption: (dims: number) => `2D squash of ${thousands(dims)} dims`,
  },

  verdict: {
    rank: (rank: number) => `#${rank}`,
    scoreLabel: "similarity",
    found: "you found it",
    skipped: "the model picked this one",
    miss: (k: number) => `not in the top ${k}`,
    trap: {
      near: "close on the map",
      group: (group: string) => `${group}, like a real match`,
      words: (shared: string[]) => `shares “${shared.join("”, “")}” with the question`,
      plain: "just a decoy",
    },
  },

  result: {
    score: (hits: number, k: number) => `${hits} of ${k} right`,
    metricLabel: (k: number) => `precision@${k}`,
    newBest: "new best",
    /** One line per score, best first. */
    line: (hits: number, k: number, dims: number) => {
      if (hits === k) return `${capitalize(numberWord(k))} for ${numberWord(k)}. You'd make a decent embedding model, and you didn't even need a GPU.`;
      if (hits === k - 1) return "One got away. That happens to real retrievers too.";
      if (hits === 0) return "Bold picks. The model disagrees with every one, but it's only a model.";
      if (hits / k >= 0.5) return `Not bad for someone working in 2 dimensions instead of ${thousands(dims)}.`;
      if (hits / k >= 0.4) return `Meaning is slippery. The model had ${thousands(dims)} numbers, you had a hunch.`;
      return "Honestly, a few of these surprised me too, and I wrote them.";
    },
    /** The honest bit: the map is a squash, so close on it isn't close in meaning. */
    squash: (decoy: string, hit: string, dims: number) =>
      `On the map, ${decoy} sits closer to the question than ${hit}, but ${hit} is the real match. The map squashes ${thousands(dims)} numbers into 2, so close there is only a hint.`,
    squashPlain: (dims: number) =>
      `The map squashes ${thousands(dims)} numbers into 2, so close there is only a hint. The scores are measured in all ${thousands(dims)}.`,
    announce: (hits: number, k: number, precision: string) =>
      `You got ${hits} of ${k}. Precision at ${k} is ${precision}.`,
    again: "Play again",
    answer: "See the real answer",
  },
};

export type Strings = typeof strings;
