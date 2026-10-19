import retrieval from "./retrieval.json";

/**
 * The page reads like one request through a RAG app: the question is tokenized, embedded,
 * matched against my notes, and answered. These are the stops, in order. The header shows
 * them as the nav and lights up the one you're at.
 */
export const stages = [
  { id: "query", label: "query", href: "#top" },
  { id: "tokens", label: "tokens", href: "#tokens" },
  { id: "embed", label: "embed", href: "#embed" },
  { id: "retrieve", label: "retrieve", href: "#retrieve" },
  { id: "tools", label: "tools", href: "#tools" },
  { id: "work", label: "work", href: "#work" },
  { id: "answer", label: "answer", href: "#answer" },
] as const;

export type StageId = (typeof stages)[number]["id"];

export { retrieval };

export const intro =
  "Full-stack developer in Salatiga, Indonesia. Lately I build AI apps. This page answers the question above the way a RAG app would.";

export const steps = {
  tokens: `The tokenizer of ${retrieval.model} cuts the question into ${retrieval.tokens.length} tokens. Neither of my names is in its vocabulary, so each one comes out in two pieces.`,
  embed: `Then the model itself, running on my laptop through Ollama, turns those tokens into ${retrieval.dims.toLocaleString("en-US")} numbers. Here are the first ${retrieval.queryHead.length}.`,
  retrieve: `Those numbers get compared with ${retrieval.points.length} short notes I wrote about myself and my work. The five closest come back.`,
};

/** Notes that live in a public repo link there from the answer's source list. */
export const sourceLinks: Record<string, string> = {
  ralaex: "https://github.com/ramaraihan12/ralaex",
};

/**
 * Written by hand from the five retrieved notes, in the order they rank. [n] marks a citation
 * and must match a rank in retrieval.top.
 */
export const answer =
  "Rama Raihan is a full-stack developer from Salatiga, Central Java. He builds and runs web apps in Laravel and Next.js [1]. Lately he's been building AI apps: RAG, agents, chatbots and workflow automation [3]. He has built Midtrans payments into Indonesian projects [4], and he made the finance app he and his wife track their spending in [2]. He works on UTC+7 and is happy to join a remote team anywhere [5].";
