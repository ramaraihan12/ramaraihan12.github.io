import { otherProjects } from "@/content/projects";
import { ArrowUpRightIcon } from "./icons";

export function OtherProjects() {
  return (
    <section aria-labelledby="other-title" className="container-page pb-16 sm:pb-24">
      <h2 id="other-title" className="type-display text-xl text-ink sm:text-2xl">
        Other projects
      </h2>

      <ul className="mt-6 border-b border-line">
        {otherProjects.map((project) => (
          <li
            key={project.name}
            className="grid gap-2 border-t border-line py-5 md:grid-cols-[13rem_1fr] md:gap-8"
          >
            <a
              href={project.href}
              className="inline-flex items-center gap-1.5 self-start font-mono text-[0.95rem] font-semibold text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-indigo"
            >
              {project.name}
              <span className="sr-only"> on GitHub</span>
              <ArrowUpRightIcon className="size-3.5 text-muted" />
            </a>
            <div>
              <p className="max-w-2xl text-pretty text-muted">{project.summary}</p>
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Stack">
                {project.stack.map((tech) => (
                  <li
                    key={tech}
                    className="rounded-md border border-line px-2 py-0.5 font-mono text-xs text-muted"
                  >
                    {tech}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-6 max-w-2xl text-sm text-muted">
        Most of my client work lives in private repos, so it isn&apos;t listed here.
      </p>
    </section>
  );
}
