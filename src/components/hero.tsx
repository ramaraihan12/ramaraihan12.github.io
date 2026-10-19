import Image from "next/image";
import { site } from "@/content/site";
import { riseDelay } from "@/lib/style";
import { ArrowUpRightIcon, GitHubIcon, MailIcon } from "./icons";

const now = [
  {
    label: "Building",
    value: "AI apps with LangGraph, LlamaIndex, the Vercel AI SDK and Prism",
  },
  {
    label: "Running",
    value: "Laravel and Next.js apps on my own VPS, deployed with Coolify",
  },
  { label: "Based in", value: "Salatiga, Indonesia (UTC+7)" },
];

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="container-page pt-12 pb-16 sm:pt-20 sm:pb-24">
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between md:gap-12">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-full border border-line md:order-last md:h-[22rem] md:w-[16.5rem] md:rounded-2xl">
          <Image
            src="/images/rama.jpg"
            alt="Rama Raihan at night in a cap, holding a fish up to his ear like a phone"
            fill
            loading="eager"
            fetchPriority="high"
            sizes="(min-width: 768px) 264px, 96px"
            className="object-cover object-[50%_45%] md:object-center"
          />
        </div>

        <div className="max-w-2xl">
          <p className="rise font-mono text-sm text-muted">{site.role}</p>
          <h1
            id="hero-title"
            className="rise type-display mt-3 text-[clamp(3.25rem,12vw,7.5rem)] leading-[0.9] text-ink"
            style={riseDelay(80)}
          >
            Rama
            <br />
            Raihan
          </h1>
          <p
            className="rise mt-6 max-w-xl text-lg text-pretty text-ink/85 sm:text-xl"
            style={riseDelay(160)}
          >
            I build and run web apps in Laravel and Next.js. Lately I&apos;ve been
            building AI apps: RAG, agents, chatbots and workflow automation.
          </p>
          <div
            className="rise mt-8 flex flex-wrap gap-3"
            style={riseDelay(240)}
          >
            <a
              href={`mailto:${site.email}`}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo px-4 py-2.5 text-sm font-semibold text-on-indigo transition-opacity hover:opacity-90"
            >
              <MailIcon className="size-4" />
              Email me
            </a>
            <a
              href={site.github}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-indigo"
            >
              <GitHubIcon className="size-4" />
              GitHub
              <ArrowUpRightIcon className="size-3.5 text-muted" />
            </a>
          </div>
        </div>
      </div>

      <dl className="mt-14 grid gap-6 border-t border-line pt-6 sm:grid-cols-3 sm:gap-8">
        {now.map((item) => (
          <div key={item.label}>
            <dt className="font-mono text-xs tracking-wide text-muted uppercase">{item.label}</dt>
            <dd className="mt-1.5 text-[0.95rem] text-pretty text-ink">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
