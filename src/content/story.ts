import { aiProjects, otherProjects, webProjects } from "./projects";
import retrieval from "./retrieval.json";
import { site } from "./site";

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

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
/** Small counts read better as words in a sentence. */
const inWords = (n: number) => WORDS[n] ?? n.toLocaleString("en-US");

export const intro =
  "I'm a full-stack developer in Salatiga, Central Java, and lately I build AI apps. Scroll, and this page answers the question the way a RAG app would.";

export const steps = {
  tokens: `First the tokenizer of ${retrieval.model} cuts the question into ${retrieval.tokens.length} tokens. Neither of my names is in its vocabulary, so each one comes out in two pieces.`,
  embed: `Then the model, running on my laptop through Ollama, turns those tokens into ${retrieval.dims.toLocaleString("en-US")} numbers. Here are the first ${retrieval.queryHead.length}.`,
  retrieve: `Those numbers get compared with ${retrieval.points.length} short notes I wrote about myself and my work. The ${inWords(retrieval.top.length)} closest come back.`,
};

/**
 * Notes about a project with public code link to its repo from the answer's source list.
 * Derived from the project lists, so a newly retrieved project note links without a change here.
 */
export const sourceLinks: Record<string, string> = Object.fromEntries(
  [...aiProjects, ...webProjects, ...otherProjects].flatMap((p) =>
    p.href?.startsWith(`${site.github}/`) ? [[p.name, p.href] as const] : [],
  ),
);

/**
 * Written by hand from the five retrieved notes, in the order they rank. [n] marks a citation
 * and must match a rank in retrieval.top.
 */
export const answer =
  "Rama Raihan is a full-stack developer from Salatiga, a small city in the hills of Central Java. He builds and runs web apps in Laravel and Next.js [1]. He also built the finance app he and his wife log their spending in [2]. Lately he's been building AI apps: RAG, agents, chatbots and workflow automation [3]. On his Indonesian projects, payments go through Midtrans [4]. He works on UTC+7 and is happy to join a remote team anywhere [5].";
