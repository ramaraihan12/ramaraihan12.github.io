import { otherProjects } from "@/content/projects";
import { ArrowUpRightIcon } from "./icons";

export function AlsoBuilt() {
  return (
    <section aria-labelledby="also-title" className="also">
      <div className="container-page">
        <h2 id="also-title" className="also-title">
          Other things I&apos;ve built
        </h2>

        <ul className="also-list">
          {otherProjects.map((project) => (
            <li key={project.name} className="also-row" data-reveal>
              {project.href ? (
                <a href={project.href} className="also-name">
                  {project.name}
                  <span className="sr-only"> on GitHub</span>
                  <ArrowUpRightIcon className="size-4" />
                </a>
              ) : (
                <span className="also-name">{project.name}</span>
              )}
              <div>
                <p className="also-summary">{project.summary}</p>
                <ul className="chips mt-3" aria-label="Stack">
                  {project.stack.map((tech) => (
                    <li key={tech}>{tech}</li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>

        <p className="also-note">Most of my client work lives in private repos, so it isn&apos;t listed here.</p>
      </div>
    </section>
  );
}
