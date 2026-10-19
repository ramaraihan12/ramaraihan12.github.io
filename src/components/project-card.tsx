import type { Project } from "@/content/projects";
import { ArrowUpRightIcon, GitHubIcon } from "./icons";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="group relative flex h-full flex-col rounded-xl border border-line bg-surface p-5 transition-colors hover:border-indigo/50 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-4 has-[a:focus-visible]:outline-kunyit sm:p-6">
      <h3 className="font-mono text-[0.95rem] font-semibold text-ink">
        {/* The ::after overlay makes the whole card clickable while keeping one link per card. */}
        <a
          href={project.href}
          className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
        >
          {project.name}
          <span className="sr-only"> on GitHub</span>
        </a>
      </h3>

      <p className="mt-2 text-pretty text-muted">{project.summary}</p>

      {project.flow ? (
        <ol className="flow mt-4 rounded-lg bg-paper px-3 py-2" aria-label="How it works">
          {project.flow.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}

      <div className="mt-auto flex items-end justify-between gap-4 pt-5">
        <ul className="flex flex-wrap gap-1.5" aria-label="Stack">
          {project.stack.map((tech) => (
            <li
              key={tech}
              className="rounded-md border border-line px-2 py-0.5 font-mono text-xs text-muted"
            >
              {tech}
            </li>
          ))}
        </ul>
        <span
          aria-hidden="true"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-indigo"
        >
          <GitHubIcon className="size-4" />
          GitHub
          <ArrowUpRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </article>
  );
}
