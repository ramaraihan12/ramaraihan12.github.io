/**
 * The words on the page that aren't notes or project write-ups, grouped by section. Each group
 * says which file its strings came from. The components don't read this file yet; they still
 * have their own copies of the older strings.
 *
 * Counts come from the content files, so a heading like "Eight AI apps I built" stays right
 * when a project is added.
 */
import { aiProjects } from "./projects";
import retrieval from "./retrieval.json";
import { site } from "./site";

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** Small counts as words ("five"), bigger ones as digits ("1,024"). */
export function countWord(n: number, capitalize = false): string {
  const word = WORDS[n] ?? n.toLocaleString("en-US");
  return capitalize ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

const dims = retrieval.dims.toLocaleString("en-US");
const topK = retrieval.top.length;

/** From src/app/layout.tsx. */
export const layoutCopy = {
  skipLink: "Skip to content",
} as const;

/** From src/components/site-header.tsx. The stage labels live in story.ts. */
export const headerCopy = {
  navLabel: "Sections",
  email: "Email me",
  copied: "Copied",
} as const;

/** From src/components/email-link.tsx. Read out by screen readers after a click. */
export const emailLinkCopy = {
  copiedStatus: "Email address copied",
} as const;

/** From src/components/query-scene.tsx. The intro and step captions live in story.ts. */
export const queryCopy = {
  eyebrow: "query",
  /** The arrow after it is drawn separately. */
  scrollHint: "scroll to run",
  stepEyebrows: { tokens: "tokens", embed: "embed", retrieve: "retrieve" },
  tokensLabel: "Tokens",
  /** Closes the row of numbers: "… 1,012 more". */
  moreNumbers: (n: number) => `… ${n.toLocaleString("en-US")} more`,
  resultsHead: (k: number, total: number) => `top ${k} of ${total} · cosine similarity`,
  /** Screen-reader prefix for each card's score. */
  scoreLabel: "similarity",
} as const;

/** From src/components/tools-section.tsx. */
export const toolsCopy = {
  eyebrow: "tools",
  title: "What I work with",
  lead: "Client work runs on the web stack. My recent projects add the AI tools.",
} as const;

/** From src/components/pipeline.tsx. */
export const pipelineCopy = {
  label: "How a request moves through it",
} as const;

/** From src/components/run-section.tsx: the AI apps. */
export const workCopy = {
  eyebrow: "work",
  title: `${countWord(aiProjects.length, true)} AI apps I built`,
  lead: "Most run on a local model through Ollama by default, so you can try them without an API key.",
  /** The arrow after it is drawn separately. */
  scrollHint: "keep scrolling",
  stackLabel: "Stack",
  codeLink: "Read the code",
  /** Screen-reader ending for the code link: "Read the code for antre". */
  codeLinkFor: (name: string) => ` for ${name}`,
  /** For a project with a `demo`. */
  demoLink: "Try it",
  outro: "Everything else, including the commits, is on GitHub.",
  outroLink: site.github.replace(/^https:\/\//, ""),
} as const;

/** New: the group heading for webProjects. */
export const webCopy = {
  eyebrow: "web & infra",
  title: "Web apps, and the plumbing under them",
  lead: "No model in these. Each one is built for a bad day, like the internet dropping at the till or a payment callback landing mid-deploy.",
} as const;

/** From src/components/also-built.tsx. */
export const alsoCopy = {
  title: "Other things I've built",
  stackLabel: "Stack",
  /** Screen-reader ending for a GitHub link. */
  onGitHub: " on GitHub",
  /** Screen-reader ending for any other link, like project-clipper's page. */
  projectPage: ", project page",
  demoLink: "Try it",
  note: "Most of my client work lives in private repos, so it isn't listed here.",
} as const;

/** New: the Nearest Neighbors game. */
export const playCopy = {
  eyebrow: "play",
  title: "Nearest Neighbors",
  intro: `Here's the question and a handful of my notes. Pick the ${countWord(topK)} you think a retriever would bring back.`,
  notesLabel: "Notes to pick from",
  pickLabel: (source: string) => `Pick the note from ${source}`,
  picked: (n: number) => `${n} of ${topK} picked`,
  check: "Check my picks",
  again: "Play again",
  clear: "Clear",
  yourPicks: "Your picks",
  realTop: `The real top ${countWord(topK)}`,
  /** Shown above the result line. */
  score: (hits: number) => `precision@${topK}: ${hits}/${topK}`,
  /** Index is the number of correct picks. */
  results: [
    "You and the model read this question very differently. Both readings are allowed.",
    "One shared neighbor. The model is a stubborn reader.",
    "Not bad for someone working in two dimensions.",
    "More right than wrong. You think a bit like an embedding model.",
    "One away. The model is getting nervous.",
    `Perfect. Are you secretly ${dims} numbers?`,
  ],
  /** Be honest about the map. */
  mapNote: `The map squashes ${dims} numbers into 2 with PCA, so dots that look close may not be. The real ranking uses cosine similarity on all ${dims}.`,
  /** When scripts don't run. */
  noScript: `This game needs JavaScript. The real top ${countWord(topK)} are in the retrieve step above.`,
  /** With reduced motion the game still works, just without animation. */
  reducedMotion: "Motion is off, so the results show up all at once.",
} as const;

/** From src/components/answer-scene.tsx. The answer itself lives in story.ts. */
export const answerCopy = {
  eyebrow: `answer · from the ${countWord(topK)} notes above`,
  /** Screen-reader heading. */
  title: "The answer",
  citeLabel: (n: number) => `source ${n}`,
  sourcesLabel: "Sources",
  photoSmallAlt: "Rama Raihan in a black tuxedo and bow tie",
  photoLargeAlt: "Rama Raihan in a black tuxedo and bow tie, standing in a garden",
  note: `The tokens, numbers and scores up top are real, from a model on my laptop. This answer isn't generated. I wrote it from those ${countWord(topK)} notes.`,
  allNotes: `All ${retrieval.points.length} notes`,
} as const;

/** From src/components/contact.tsx. */
export const contactCopy = {
  eyebrow: "follow-up",
  title: "Ask me something else",
  lead: "Have a project in mind, with AI or without? Email is the best way to reach me.",
  email: "Email me",
  copied: "Copied",
  github: "GitHub",
  /**
   * New: a caption under the sky, by the time in Salatiga. Roughly morning 5 to 10, day 10 to
   * 17, dusk 17 to 19, night 19 to 5.
   */
  sky: {
    morning: "Morning in Salatiga. Coffee first, then email.",
    day: "Daytime in Salatiga. I'm likely at my desk.",
    dusk: "Dusk in Salatiga. Wrapping up for the day.",
    night: "Night in Salatiga. I'm probably asleep.",
  },
} as const;

/** From src/components/salatiga-clock.tsx. The time sits between the two parts. */
export const clockCopy = {
  before: "It's",
  after: "in Salatiga (UTC+7)",
  /** Before the time is known, and without scripts. */
  fallback: "Salatiga, UTC+7",
} as const;

/** From src/components/site-footer.tsx. */
export const footerCopy = {
  copyright: (year: number) => `© ${year} ${site.name} · ${site.location}`,
  colors: "The colors are nila and kunyit, indigo and turmeric, both natural dyes used in Javanese batik.",
  source: "Source",
} as const;

/** From src/app/og.png/route.tsx, the link preview card. */
export const ogCopy = {
  kicker: `${site.role} · ${site.location}`,
  title: ["Who is", "Rama Raihan?"],
  tagline: "Laravel and Next.js web apps. Lately AI apps too: RAG, agents, chatbots and automation.",
} as const;

export type Achievement = { title: string; body: string };

/** New: toasts for small things found along the way. */
export const achievements = {
  allStages: { title: "Whole pipeline", body: "You visited every stage of the pipeline." },
  gameDone: { title: "Retriever for a minute", body: "You finished Nearest Neighbors. Thanks for standing in for the model." },
  gamePerfect: {
    title: `${countWord(topK, true)} for ${countWord(topK)}`,
    body: `Every pick matched the real top ${countWord(topK)}. Nice.`,
  },
  konami: { title: "Batik mode", body: "You found it. Up, up, down, down still works." },
  consoleSource: { title: "Source reader", body: "You found the note in the console. Hi, fellow developer." },
} as const satisfies Record<string, Achievement>;

/** New: printed to the browser console for anyone who opens it. One entry per line. */
export const consoleGreeting = [
  "Hi. If you're reading this, you probably build things too.",
  "Everything here is static: real embeddings in one JSON file, and a lot of GSAP.",
  "The answer at the end isn't generated. I wrote it.",
  `Source: ${site.source}`,
] as const;
